DOCKER_DIR := infra/docker
DOCKER_COMPOSE := docker compose -f $(DOCKER_DIR)/compose.yaml
DOCKER_COMPOSE_DEV := $(DOCKER_COMPOSE) -f $(DOCKER_DIR)/compose.dev.yaml
DOCKER_COMPOSE_STAGING := $(DOCKER_COMPOSE) -f $(DOCKER_DIR)/compose.staging.yaml
DOCKER_COMPOSE_PROD := $(DOCKER_COMPOSE) -f $(DOCKER_DIR)/compose.prod.yaml
DOCKER_DEV_PROFILES := --profile dev --profile vpc
DOCKER_PROD_PROFILES := --profile vpc --profile backup
CLOUDFLARE_TUNNEL_TOKEN_FILE ?= $(abspath $(DOCKER_DIR)/secrets/cloudflare-tunnel-token)
CLOUDFLARE_API_TOKEN_FILE ?= $(abspath $(DOCKER_DIR)/secrets/cloudflare-api-token)
POSTGRES_BACKUP_SECRET_DIR ?= /run/vibe-code-stack/secrets
POSTGRES_BACKUP_EXEC := $(DOCKER_COMPOSE_PROD) $(DOCKER_PROD_PROFILES) exec --user postgres postgres-backup
export CLOUDFLARE_TUNNEL_TOKEN_FILE
export CLOUDFLARE_API_TOKEN_FILE
export POSTGRES_BACKUP_SECRET_DIR

.PHONY: test-postgres-backup-scripts
test-postgres-backup-scripts:
	@set -eu; for test_file in infra/docker/postgres/tests/*.test.sh; do bash "$$test_file"; done

.PHONY: test-postgres-backup-integration
test-postgres-backup-integration:
	@bash infra/docker/postgres/tests/backup-integration.sh

.PHONY: db-backup-info
db-backup-info: ## Show pgBackRest backup sets and archived WAL metadata.
	@$(POSTGRES_BACKUP_EXEC) pgbackrest \
		--config=/run/postgres-backup/pgbackrest.conf --stanza=trading-rpc info

.PHONY: db-backup-now
db-backup-now: ## Run a serialized manual full backup.
	@$(POSTGRES_BACKUP_EXEC) \
		/usr/local/bin/postgres-backup/run-backup-job.sh full \
		pgbackrest --config=/run/postgres-backup/pgbackrest.conf \
		--stanza=trading-rpc --type=full backup

.PHONY: db-backup-check
db-backup-check: ## Check PostgreSQL and pgBackRest repository consistency.
	@$(POSTGRES_BACKUP_EXEC) \
		/usr/local/bin/postgres-backup/run-backup-job.sh check \
		pgbackrest --config=/run/postgres-backup/pgbackrest.conf \
		--stanza=trading-rpc check

.PHONY: db-backup-verify
db-backup-verify: ## Verify pgBackRest repository contents.
	@$(POSTGRES_BACKUP_EXEC) \
		/usr/local/bin/postgres-backup/run-backup-job.sh verify \
		pgbackrest --config=/run/postgres-backup/pgbackrest.conf \
		--stanza=trading-rpc verify

.PHONY: db-backup-health
db-backup-health: ## Evaluate backup health and print the persisted JSON result.
	@$(POSTGRES_BACKUP_EXEC) sh -ceu \
		'set +e; /usr/local/bin/postgres-backup/backup-health.sh >/dev/null; status=$$?; set -e; jq . /var/lib/postgres-backup/state/health.json; exit $$status'

.PHONY: db-restore-latest
db-restore-latest: ## Restore latest PITR point into a new isolated restore directory.
	@test "$(CONFIRM_RESTORE)" = restore-into-new-volume || { \
		echo 'Set CONFIRM_RESTORE=restore-into-new-volume' >&2; exit 64; \
	}
	@$(POSTGRES_BACKUP_EXEC) sh -ceu \
		'restore_id="manual-pitr-$$(date -u +%Y%m%dT%H%M%SZ)-$$$$"; target="$$POSTGRES_RESTORE_ROOT/$$restore_id"; /usr/local/bin/postgres-backup/restore-pitr.sh --target-dir "$$target" --latest; printf "Restored PGDATA: %s\nRestored tablespaces: %s.tablespaces\n" "$$target" "$$target"'

.PHONY: db-restore-at
db-restore-at: ## Restore PITR to TARGET_TIME into a new isolated restore directory.
	@test "$(CONFIRM_RESTORE)" = restore-into-new-volume || { \
		echo 'Set CONFIRM_RESTORE=restore-into-new-volume' >&2; exit 64; \
	}
	@test -n "$(TARGET_TIME)" || { echo 'Set TARGET_TIME to an RFC3339 timestamp' >&2; exit 64; }
	@$(DOCKER_COMPOSE_PROD) $(DOCKER_PROD_PROFILES) exec --user postgres \
		-e TARGET_TIME="$(TARGET_TIME)" postgres-backup sh -ceu \
		'restore_id="manual-pitr-$$(date -u +%Y%m%dT%H%M%SZ)-$$$$"; target="$$POSTGRES_RESTORE_ROOT/$$restore_id"; /usr/local/bin/postgres-backup/restore-pitr.sh --target-dir "$$target" --target-time "$$TARGET_TIME"; printf "Restored PGDATA: %s\nRestored tablespaces: %s.tablespaces\n" "$$target" "$$target"'

.PHONY: db-restore-drill
db-restore-drill: ## Run the serialized latest-PITR restore drill and publish evidence.
	@$(POSTGRES_BACKUP_EXEC) \
		/usr/local/bin/postgres-backup/run-backup-job.sh pitr-drill \
		/usr/local/bin/postgres-backup/restore-pitr.sh --latest --drill

.PHONY: build-development
build-development: ## Build all images used by the full development stack.
	$(DOCKER_COMPOSE_DEV) $(DOCKER_DEV_PROFILES) build

.PHONY: start-development
start-development: check-vpc-tunnel-token sync-cloudflare-api-token build-development ## Start all five apps plus PostgreSQL and cloudflared.
	$(DOCKER_COMPOSE_DEV) $(DOCKER_DEV_PROFILES) up -d

.PHONY: stop-development
stop-development: ## Stop the full development stack.
	$(DOCKER_COMPOSE_DEV) $(DOCKER_DEV_PROFILES) down

.PHONY: logs-development
logs-development: ## Follow logs for all development services.
	$(DOCKER_COMPOSE_DEV) $(DOCKER_DEV_PROFILES) logs --follow

.PHONY: check-vpc-tunnel-token
check-vpc-tunnel-token: ## Ensure the remote Tunnel token exists outside Git.
	@test -s "$(CLOUDFLARE_TUNNEL_TOKEN_FILE)" || { \
		echo "Missing Cloudflare Tunnel token: $(CLOUDFLARE_TUNNEL_TOKEN_FILE)" >&2; \
		echo "Create it from the rotated token before starting the VPC connector." >&2; \
		exit 1; \
	}

.PHONY: sync-cloudflare-api-token
sync-cloudflare-api-token: ## Refresh the Docker secret from the active Wrangler login/API token.
	@mkdir -p "$(dir $(CLOUDFLARE_API_TOKEN_FILE))"
	@pnpm --filter @services/api-gateway exec wrangler auth token --json | \
		CLOUDFLARE_API_TOKEN_FILE="$(CLOUDFLARE_API_TOKEN_FILE)" node -e 'const fs = require("node:fs"); let raw = ""; process.stdin.setEncoding("utf8"); process.stdin.on("data", (chunk) => { raw += chunk; }); process.stdin.on("end", () => { const auth = JSON.parse(raw); if (typeof auth.token !== "string" || auth.token.length === 0) throw new Error("Wrangler authentication did not return a bearer token"); fs.writeFileSync(process.env.CLOUDFLARE_API_TOKEN_FILE, auth.token, { mode: 0o600 }); fs.chmodSync(process.env.CLOUDFLARE_API_TOKEN_FILE, 0o600); });'

.PHONY: start-vpc-development
start-vpc-development: check-vpc-tunnel-token ## Start PostgreSQL, trading-rpc, and its Cloudflare VPC Tunnel connector.
	$(DOCKER_COMPOSE_DEV) --profile dev --profile vpc up -d --build postgres trading-rpc cloudflared

.PHONY: stop-vpc-development
stop-vpc-development: ## Stop and remove the local trading-rpc VPC stack.
	$(DOCKER_COMPOSE_DEV) --profile dev --profile vpc rm --stop --force cloudflared trading-rpc postgres

.PHONY: logs-vpc-development
logs-vpc-development: ## Follow PostgreSQL, trading-rpc, and cloudflared logs.
	$(DOCKER_COMPOSE_DEV) --profile dev --profile vpc logs --follow postgres trading-rpc cloudflared

.PHONY: psql-development
psql-development: ## Open psql inside the development PostgreSQL container.
	$(DOCKER_COMPOSE_DEV) --profile dev exec postgres sh -lc \
		'exec psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"'

.PHONY: build-staging
build-staging: ## Build the staging docker image.
	$(DOCKER_COMPOSE_STAGING) build

.PHONY: start-staging
start-staging: ## Start the staging docker container.
	$(DOCKER_COMPOSE_STAGING) up -d

.PHONY: stop-staging
stop-staging: ## Stop the staging docker container.
	$(DOCKER_COMPOSE_STAGING) down

.PHONY: build-production
build-production: ## Build the production docker image.
	$(DOCKER_COMPOSE_PROD) $(DOCKER_PROD_PROFILES) build

.PHONY: sync-production-backup-secrets
sync-production-backup-secrets: ## Fetch production database and R2 secrets with the EC2 instance profile.
	@infra/docker/postgres/scripts/sync-production-secrets.sh

.PHONY: start-production
start-production: sync-production-backup-secrets ## Start the production docker container.
	$(DOCKER_COMPOSE_PROD) $(DOCKER_PROD_PROFILES) up -d --force-recreate

.PHONY: stop-production
stop-production: ## Stop the production docker container.
	$(DOCKER_COMPOSE_PROD) $(DOCKER_PROD_PROFILES) down

.PHONY: check-docker
check-docker: ## Validate Compose overlays, Dockerfiles, and the single-source layout.
	@set -eu; \
	for target in db-backup-info db-backup-now db-backup-check db-backup-verify \
		db-backup-health db-restore-latest db-restore-at db-restore-drill \
		test-postgres-backup-integration; do \
		grep -Eq "^$$target:" Makefile || { \
			echo "Missing PostgreSQL operator target: $$target" >&2; \
			exit 1; \
		}; \
	done; \
	for legacy_path in compose.yml development staging production; do \
		if [ -e "$(DOCKER_DIR)/$$legacy_path" ]; then \
			echo "Legacy nested Docker layout detected: $(DOCKER_DIR)/$$legacy_path" >&2; \
			exit 1; \
		fi; \
	done
	@$(DOCKER_COMPOSE_DEV) $(DOCKER_DEV_PROFILES) \
		config --no-env-resolution --quiet
	@$(DOCKER_COMPOSE_STAGING) --profile vpc \
		config --no-env-resolution --quiet
	@POSTGRES_BACKUP_SERVICE_NAME=trading-rpc-example \
		POSTGRES_ARCHIVE_AGE_RECIPIENT=age1ywhyzhzs70xzcyleft4cagvtn5qnsfeln4fte9d7g4ar6jhrgd9q233rhe \
		POSTGRES_BACKUP_RECOVERY_SECRET_ID=example/monthly-recovery-key \
		POSTGRES_BACKUP_KMS_KEY_ID=alias/vibe-postgres-monthly-auth \
		POSTGRES_BACKUP_TRUSTED_KMS_KEY_IDS=arn:aws:kms:ap-southeast-1:111122223333:key/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee \
		AWS_REGION=ap-southeast-1 \
		$(DOCKER_COMPOSE_PROD) $(DOCKER_PROD_PROFILES) \
		config --no-env-resolution --quiet
	@services="$$( \
		$(DOCKER_COMPOSE) $(DOCKER_DEV_PROFILES) config --services \
	)"; \
	for service in dapp admin landing api-gateway postgres trading-rpc cloudflared; do \
		echo "$$services" | grep -qx "$$service" || { \
			echo "Missing development service: $$service" >&2; \
			exit 1; \
		}; \
	done
	@$(DOCKER_COMPOSE_DEV) $(DOCKER_DEV_PROFILES) --profile backup config --format json | \
		node -e 'let raw = ""; process.stdin.setEncoding("utf8"); process.stdin.on("data", (chunk) => { raw += chunk; }); process.stdin.on("end", () => { const config = JSON.parse(raw); const networks = config.services?.["trading-rpc"]?.networks ?? {}; const expected = process.env.TRADING_RPC_PRIVATE_HOSTNAME || "trading-rpc.internal"; const privateAliases = networks["trading-rpc-private"]?.aliases ?? []; if (!privateAliases.includes(expected)) throw new Error(`Missing private trading-rpc alias: $${expected}`); for (const name of ["trading-rpc-data", "trading-rpc-egress"]) { if ((networks[name]?.aliases ?? []).includes(expected)) throw new Error(`Private trading-rpc alias leaked to $${name}`); } if (config.networks?.["trading-rpc-data"]?.internal !== true) throw new Error("trading-rpc-data must be internal"); const postgres = config.services?.postgres; const backup = config.services?.["postgres-backup"]; if (!postgres?.build?.dockerfile?.endsWith("infra/docker/postgres.Dockerfile")) throw new Error("PostgreSQL must use the repository backup image"); if (!postgres?.ports?.some((port) => port.host_ip === "127.0.0.1")) throw new Error("Development PostgreSQL must publish loopback only"); if (!("postgres-development-host" in (postgres?.networks ?? {}))) throw new Error("Development PostgreSQL needs a non-internal host bridge"); if (!backup) throw new Error("Missing postgres-backup service"); if (backup.user) throw new Error("postgres-backup must bootstrap as root before dropping privileges"); if (!(backup.cap_add ?? []).includes("CHOWN") || !(backup.cap_add ?? []).includes("SETUID") || !(backup.cap_add ?? []).includes("SETGID")) throw new Error("postgres-backup is missing minimal bootstrap capabilities"); if (backup.volumes?.some((mount) => mount.source === "/var/run/docker.sock")) throw new Error("postgres-backup must not mount the Docker socket"); if (backup.ports?.length) throw new Error("postgres-backup must not publish ports"); for (const name of ["postgres-socket", "pgbackrest-spool", "postgres-backup-state", "postgres-backup-stage", "postgres-restore-stage"]) { if (!config.volumes?.[name]) throw new Error(`Missing backup volume: $${name}`); } const restoreMount = (backup.volumes ?? []).find((mount) => mount.target === "/var/lib/postgres-backup/restores"); if (restoreMount?.source !== "postgres-restore-stage") throw new Error("Restore drills require a dedicated volume"); if (backup.environment?.POSTGRES_RESTORE_ROOT !== "/var/lib/postgres-backup/restores") throw new Error("Restore root must use the dedicated volume"); });'
	@POSTGRES_BACKUP_SERVICE_NAME=trading-rpc-example \
		POSTGRES_ARCHIVE_AGE_RECIPIENT=age1ywhyzhzs70xzcyleft4cagvtn5qnsfeln4fte9d7g4ar6jhrgd9q233rhe \
		POSTGRES_BACKUP_RECOVERY_SECRET_ID=example/monthly-recovery-key \
		POSTGRES_BACKUP_KMS_KEY_ID=alias/vibe-postgres-monthly-auth \
		POSTGRES_BACKUP_TRUSTED_KMS_KEY_IDS=arn:aws:kms:ap-southeast-1:111122223333:key/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee \
		AWS_REGION=ap-southeast-1 \
		$(DOCKER_COMPOSE_PROD) $(DOCKER_PROD_PROFILES) \
		config --no-env-resolution --format json | \
		node -e 'let raw = ""; process.stdin.setEncoding("utf8"); process.stdin.on("data", (chunk) => { raw += chunk; }); process.stdin.on("end", () => { const config = JSON.parse(raw); const postgres = config.services?.postgres; const backup = config.services?.["postgres-backup"]; const tradingRpc = config.services?.["trading-rpc"]; if (!("postgres-backup-egress" in (postgres?.networks ?? {}))) throw new Error("Production PostgreSQL must have explicit backup egress"); if (!(postgres?.tmpfs ?? []).some((mount) => mount.startsWith("/run/postgres-backup:"))) throw new Error("PostgreSQL runtime secrets/config must use tmpfs"); for (const target of ["/run/postgres-backup:", "/run/postgres-backup-secrets:"]) { if (!(backup?.tmpfs ?? []).some((mount) => mount.startsWith(target))) throw new Error(`postgres-backup is missing tmpfs: $${target}`); } const tradingTmpfs = (tradingRpc?.tmpfs ?? []).find((mount) => mount.startsWith("/run/trading-rpc:")) ?? ""; if (!tradingTmpfs.includes("mode=0700")) throw new Error("Trading RPC tmpfs must be private"); });'
	@grep -Fq 'ENTRYPOINT ["/usr/local/bin/trading-rpc-entrypoint.sh"]' $(DOCKER_DIR)/trading-rpc.Dockerfile || { \
		echo "Trading RPC image must use the root secret bootstrap entrypoint" >&2; \
		exit 1; \
	}
	@set -eu; \
	unexpected="$$(find . -type f \
		\( -name 'Dockerfile' -o -name '*.Dockerfile' -o -name 'Dockerfile.*' \) \
		! -path './infra/docker/*' \
		! -path './node_modules/*' \
		! -path './.omx/*' \
		! -path './.git/*' -print)"; \
	if [ -n "$$unexpected" ]; then \
		echo "Dockerfiles outside $(DOCKER_DIR):" >&2; \
		echo "$$unexpected" >&2; \
		exit 1; \
	fi
	@docker build --check -f $(DOCKER_DIR)/dapp.Dockerfile .
	@docker build --check -f $(DOCKER_DIR)/trading-rpc.Dockerfile .
	@docker build --check -f $(DOCKER_DIR)/workspace-dev.Dockerfile .
