DOCKER_DIR := infra/docker
DOCKER_COMPOSE := docker compose -f $(DOCKER_DIR)/compose.yaml
DOCKER_COMPOSE_DEV := $(DOCKER_COMPOSE) -f $(DOCKER_DIR)/compose.dev.yaml
DOCKER_COMPOSE_STAGING := $(DOCKER_COMPOSE) -f $(DOCKER_DIR)/compose.staging.yaml
DOCKER_COMPOSE_PROD := $(DOCKER_COMPOSE) -f $(DOCKER_DIR)/compose.prod.yaml
DOCKER_COMPOSE_EC2 := docker compose -f $(DOCKER_DIR)/compose.ec2.yaml
DOCKER_DEV_PROFILES := --profile dev --profile vpc
DOCKER_DEV_SERVICE_UP := $(DOCKER_COMPOSE_DEV) $(DOCKER_DEV_PROFILES) up -d --build
DOCKER_PROD_PROFILES := --profile vpc --profile backup
DOCKER_CHECK_PUBLIC_ENV := NEXT_PUBLIC_API_ENDPOINT=https://api.example.invalid NEXT_PUBLIC_BASE_URL=https://app.example.invalid NEXT_PUBLIC_CORS_COOKIE=example.invalid
DOCKER_CHECK_STAGING_ENV_FILES := STAGING_DAPP_ENV_FILE=../../apps/dapp/.env.sample STAGING_TRADING_RPC_ENV_FILE=../../services/trading-rpc/.env.sample STAGING_ADMIN_RPC_ENV_FILE=../../services/admin-rpc/.env.sample
DOCKER_CHECK_PRODUCTION_ENV_FILES := PRODUCTION_DAPP_ENV_FILE=../../apps/dapp/.env.sample PRODUCTION_TRADING_RPC_ENV_FILE=../../services/trading-rpc/.env.sample PRODUCTION_ADMIN_RPC_ENV_FILE=../../services/admin-rpc/.env.sample
DOCKER_CHECK_EC2_ENV := DEPLOYMENT_ENVIRONMENT=staging AWS_REGION=ap-southeast-1 TRADING_RPC_IMAGE=example.invalid/trading-rpc:sha ADMIN_RPC_IMAGE=example.invalid/admin-rpc:sha POSTGRES_IMAGE=example.invalid/postgres:sha CLOUDFLARED_IMAGE=cloudflare/cloudflared:2026.7.3@sha256:e39ee8da81ad5e05d77f38d2f51c60ca51bf2a8450ac3abab50c17fdb91d91bf RUNTIME_SECRET_DIR=/run/vibe-rpc/secrets TRADING_RPC_LOG_GROUP=/example/trading-rpc ADMIN_RPC_LOG_GROUP=/example/admin-rpc CLOUDFLARED_LOG_GROUP=/example/cloudflared POSTGRES_LOG_GROUP=/example/postgres POSTGRES_BACKUP_LOG_GROUP=/example/postgres-backup POSTGRES_DATA_DIR=/srv/vibe-rpc/postgres/data POSTGRES_SOCKET_DIR=/srv/vibe-rpc/postgres/socket PGBACKREST_SPOOL_DIR=/srv/vibe-rpc/postgres/spool POSTGRES_BACKUP_STATE_DIR=/srv/vibe-rpc/postgres/backup-state POSTGRES_BACKUP_STAGE_DIR=/srv/vibe-rpc/backup-stage/stage POSTGRES_RESTORE_STAGE_DIR=/srv/vibe-rpc/restore-stage/restores POSTGRES_BACKUP_RECOVERY_SECRET_ID=example/recovery POSTGRES_BACKUP_KMS_KEY_ID=arn:aws:kms:ap-southeast-1:111122223333:key/example POSTGRES_BACKUP_TRUSTED_KMS_KEY_IDS=arn:aws:kms:ap-southeast-1:111122223333:key/example R2_ACCOUNT_ID=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa R2_PITR_BUCKET=example-pitr R2_ARCHIVE_BUCKET=example-archive POSTGRES_ARCHIVE_AGE_RECIPIENT=age1ywhyzhzs70xzcyleft4cagvtn5qnsfeln4fte9d7g4ar6jhrgd9q233rhe
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

.PHONY: test-release-image-dependencies
test-release-image-dependencies:
	@docker build -f infra/docker/admin-rpc.Dockerfile -t vibe-admin-rpc:release-test .
	@set -eu; \
	expected="$$(pnpm --filter @services/admin-rpc exec node -p 'require("@sentry/node/package.json").version')"; \
	actual="$$(docker run --rm --entrypoint node vibe-admin-rpc:release-test -p 'require("@sentry/node/package.json").version')"; \
		test "$$actual" = "$$expected" || { \
			echo "admin-rpc image dependency drift: expected $$expected, got $$actual" >&2; \
			exit 1; \
		}; \
	expected="$$(pnpm --filter @services/trading-rpc exec node -p 'require("@sentry/node/package.json").version')"; \
	actual="$$(docker run --rm --entrypoint node vibe-trading-rpc:backup-test -p 'require("@sentry/node/package.json").version')"; \
		test "$$actual" = "$$expected" || { \
			echo "trading-rpc image dependency drift: expected $$expected, got $$actual" >&2; \
			exit 1; \
		}

.PHONY: test-development-service-targets
test-development-service-targets:
	@bash infra/docker/tests/development-service-targets.test.sh

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

.PHONY: build-workspace-development
build-workspace-development: ## Build the shared development workspace image.
	$(DOCKER_COMPOSE_DEV) build dapp

.PHONY: start-postgres-development
start-postgres-development: ## Start only PostgreSQL for native service development.
	$(DOCKER_COMPOSE_DEV) --profile dev up -d --build postgres

.PHONY: start-native-development-infra
start-native-development-infra: check-vpc-tunnel-token ## Start PostgreSQL and the VPC origin for native app development.
	$(DOCKER_COMPOSE_DEV) --profile dev --profile vpc up -d --build postgres trading-rpc cloudflared

.PHONY: stop-native-development-infra
stop-native-development-infra: ## Stop native-development PostgreSQL and VPC origin containers.
	$(DOCKER_COMPOSE_DEV) --profile dev --profile vpc rm --stop --force cloudflared trading-rpc postgres

.PHONY: start-development
start-development: check-vpc-tunnel-token sync-cloudflare-api-token build-development ## Start all six runtimes plus PostgreSQL and cloudflared.
	$(DOCKER_COMPOSE_DEV) $(DOCKER_DEV_PROFILES) up -d

.PHONY: start-dapp-development
start-dapp-development: ## Start only dapp and its declared dependencies.
	$(DOCKER_DEV_SERVICE_UP) dapp

.PHONY: start-admin-development
start-admin-development: check-vpc-tunnel-token sync-cloudflare-api-token build-workspace-development ## Start only admin and its declared dependencies.
	$(DOCKER_DEV_SERVICE_UP) admin

.PHONY: start-landing-development
start-landing-development: build-workspace-development ## Start only landing and its declared dependencies.
	$(DOCKER_DEV_SERVICE_UP) landing

.PHONY: start-api-gateway-development
start-api-gateway-development: check-vpc-tunnel-token sync-cloudflare-api-token build-workspace-development ## Start only api-gateway and its declared dependencies.
	$(DOCKER_DEV_SERVICE_UP) api-gateway

.PHONY: start-trading-rpc-development
start-trading-rpc-development: ## Start only trading-rpc and its declared dependencies.
	$(DOCKER_DEV_SERVICE_UP) trading-rpc

.PHONY: start-admin-rpc-development
start-admin-rpc-development: ## Start admin-rpc and its trading-rpc dependency.
	$(DOCKER_DEV_SERVICE_UP) admin-rpc

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
check-docker: test-development-service-targets ## Validate Compose overlays, Dockerfiles, and the single-source layout.
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
	@$(DOCKER_CHECK_STAGING_ENV_FILES) $(DOCKER_CHECK_PUBLIC_ENV) \
		$(DOCKER_COMPOSE_STAGING) --profile vpc \
		config --no-env-resolution --quiet
	@$(DOCKER_CHECK_PRODUCTION_ENV_FILES) $(DOCKER_CHECK_PUBLIC_ENV) \
		POSTGRES_BACKUP_SERVICE_NAME=trading-rpc-example \
		POSTGRES_ARCHIVE_AGE_RECIPIENT=age1ywhyzhzs70xzcyleft4cagvtn5qnsfeln4fte9d7g4ar6jhrgd9q233rhe \
		POSTGRES_BACKUP_RECOVERY_SECRET_ID=example/monthly-recovery-key \
		POSTGRES_BACKUP_KMS_KEY_ID=alias/vibe-postgres-monthly-auth \
		POSTGRES_BACKUP_TRUSTED_KMS_KEY_IDS=arn:aws:kms:ap-southeast-1:111122223333:key/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee \
		AWS_REGION=ap-southeast-1 \
		$(DOCKER_COMPOSE_PROD) $(DOCKER_PROD_PROFILES) \
		config --no-env-resolution --quiet
	@$(DOCKER_CHECK_EC2_ENV) $(DOCKER_COMPOSE_EC2) \
		config --no-env-resolution --quiet
	@services="$$( \
		$(DOCKER_COMPOSE) $(DOCKER_DEV_PROFILES) config --services \
	)"; \
	for service in dapp admin landing api-gateway postgres admin-rpc trading-rpc cloudflared; do \
		echo "$$services" | grep -qx "$$service" || { \
			echo "Missing development service: $$service" >&2; \
			exit 1; \
		}; \
	done
	@$(DOCKER_COMPOSE_DEV) $(DOCKER_DEV_PROFILES) --profile backup config --format json | \
		node -e 'let raw = ""; process.stdin.setEncoding("utf8"); process.stdin.on("data", (chunk) => { raw += chunk; }); process.stdin.on("end", () => { const config = JSON.parse(raw); const networks = config.services?.["trading-rpc"]?.networks ?? {}; const expected = process.env.TRADING_RPC_PRIVATE_HOSTNAME || "trading-rpc.internal"; const privateAliases = networks["trading-rpc-private"]?.aliases ?? []; if (!privateAliases.includes(expected)) throw new Error(`Missing private trading-rpc alias: $${expected}`); for (const name of ["trading-rpc-data", "trading-rpc-egress"]) { if ((networks[name]?.aliases ?? []).includes(expected)) throw new Error(`Private trading-rpc alias leaked to $${name}`); } if (config.networks?.["trading-rpc-data"]?.internal !== true) throw new Error("trading-rpc-data must be internal"); const postgres = config.services?.postgres; const backup = config.services?.["postgres-backup"]; if (!postgres?.build?.dockerfile?.endsWith("infra/docker/postgres.Dockerfile")) throw new Error("PostgreSQL must use the repository backup image"); if (!postgres?.ports?.some((port) => port.host_ip === "127.0.0.1")) throw new Error("Development PostgreSQL must publish loopback only"); if (!("postgres-development-host" in (postgres?.networks ?? {}))) throw new Error("Development PostgreSQL needs a non-internal host bridge"); if (!backup) throw new Error("Missing postgres-backup service"); if (backup.user) throw new Error("postgres-backup must bootstrap as root before dropping privileges"); if (!(backup.cap_add ?? []).includes("CHOWN") || !(backup.cap_add ?? []).includes("SETUID") || !(backup.cap_add ?? []).includes("SETGID")) throw new Error("postgres-backup is missing minimal bootstrap capabilities"); if (backup.volumes?.some((mount) => mount.source === "/var/run/docker.sock")) throw new Error("postgres-backup must not mount the Docker socket"); if (backup.ports?.length) throw new Error("postgres-backup must not publish ports"); for (const name of ["postgres-socket", "pgbackrest-spool", "postgres-backup-state", "postgres-backup-stage", "postgres-restore-stage"]) { if (!config.volumes?.[name]) throw new Error(`Missing backup volume: $${name}`); } const restoreMount = (backup.volumes ?? []).find((mount) => mount.target === "/var/lib/postgres-backup/restores"); if (restoreMount?.source !== "postgres-restore-stage") throw new Error("Restore drills require a dedicated volume"); if (backup.environment?.POSTGRES_RESTORE_ROOT !== "/var/lib/postgres-backup/restores") throw new Error("Restore root must use the dedicated volume"); });'
	@$(DOCKER_COMPOSE_DEV) $(DOCKER_DEV_PROFILES) config --format json | \
		node -e 'let raw = ""; process.stdin.setEncoding("utf8"); process.stdin.on("data", (chunk) => { raw += chunk; }); process.stdin.on("end", () => { const config = JSON.parse(raw); const admin = config.services?.["admin-rpc"]; const trading = config.services?.["trading-rpc"]; const cloudflared = config.services?.cloudflared; if (!admin) throw new Error("Missing admin-rpc service"); if (admin.build?.args?.INCLUDE_PRETTY_LOGGER !== "true") throw new Error("Development admin-rpc image must include pino-pretty"); const adminNetworks = Object.keys(admin.networks ?? {}).sort(); if (adminNetworks.join(",") !== "admin-rpc-internal,admin-rpc-private") throw new Error("admin-rpc must use only its gRPC and VPC private networks"); const expected = process.env.ADMIN_RPC_PRIVATE_HOSTNAME || "admin-rpc.internal"; const privateAliases = admin.networks?.["admin-rpc-private"]?.aliases ?? []; if (!privateAliases.includes(expected)) throw new Error(`Missing private admin-rpc alias: $${expected}`); if ((admin.networks?.["admin-rpc-internal"]?.aliases ?? []).includes(expected)) throw new Error("Private admin-rpc alias leaked to admin-rpc-internal"); if (!("admin-rpc-private" in (cloudflared?.networks ?? {}))) throw new Error("cloudflared must share admin-rpc-private"); if (!("admin-rpc-internal" in (trading?.networks ?? {}))) throw new Error("trading-rpc must share admin-rpc-internal"); for (const name of ["admin-rpc-internal", "admin-rpc-private"]) { if (config.networks?.[name]?.internal !== true) throw new Error(`${name} must be internal`); } if (admin.environment?.TRADING_RPC_GRPC_URL !== "http://trading-rpc:50051") throw new Error("admin-rpc must call trading-rpc native gRPC through private Docker DNS"); });'
	@$(DOCKER_CHECK_PRODUCTION_ENV_FILES) $(DOCKER_CHECK_PUBLIC_ENV) \
		POSTGRES_BACKUP_SERVICE_NAME=trading-rpc-example \
		POSTGRES_ARCHIVE_AGE_RECIPIENT=age1ywhyzhzs70xzcyleft4cagvtn5qnsfeln4fte9d7g4ar6jhrgd9q233rhe \
		POSTGRES_BACKUP_RECOVERY_SECRET_ID=example/monthly-recovery-key \
		POSTGRES_BACKUP_KMS_KEY_ID=alias/vibe-postgres-monthly-auth \
		POSTGRES_BACKUP_TRUSTED_KMS_KEY_IDS=arn:aws:kms:ap-southeast-1:111122223333:key/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee \
		AWS_REGION=ap-southeast-1 \
		$(DOCKER_COMPOSE_PROD) $(DOCKER_PROD_PROFILES) \
		config --no-env-resolution --format json | \
		node -e 'let raw = ""; process.stdin.setEncoding("utf8"); process.stdin.on("data", (chunk) => { raw += chunk; }); process.stdin.on("end", () => { const config = JSON.parse(raw); const postgres = config.services?.postgres; const backup = config.services?.["postgres-backup"]; const tradingRpc = config.services?.["trading-rpc"]; if (!("postgres-backup-egress" in (postgres?.networks ?? {}))) throw new Error("Production PostgreSQL must have explicit backup egress"); if (!(postgres?.tmpfs ?? []).some((mount) => mount.startsWith("/run/postgres-backup:"))) throw new Error("PostgreSQL runtime secrets/config must use tmpfs"); for (const target of ["/run/postgres-backup:", "/run/postgres-backup-secrets:"]) { if (!(backup?.tmpfs ?? []).some((mount) => mount.startsWith(target))) throw new Error(`postgres-backup is missing tmpfs: $${target}`); } const tradingTmpfs = (tradingRpc?.tmpfs ?? []).find((mount) => mount.startsWith("/run/trading-rpc:")) ?? ""; if (!tradingTmpfs.includes("mode=0700")) throw new Error("Trading RPC tmpfs must be private"); });'
	@$(DOCKER_CHECK_EC2_ENV) $(DOCKER_COMPOSE_EC2) \
		config --no-env-resolution --format json | \
		node -e 'let raw = ""; process.stdin.setEncoding("utf8"); process.stdin.on("data", (chunk) => { raw += chunk; }); process.stdin.on("end", () => { const config = JSON.parse(raw); for (const name of ["admin-rpc", "trading-rpc", "cloudflared"]) { const service = config.services?.[name]; if (!service) throw new Error(`Missing EC2 service: $${name}`); if (service.ports?.length) throw new Error(`EC2 service must not publish host ports: $${name}`); if (service.read_only !== true) throw new Error(`EC2 service must use a read-only root filesystem: $${name}`); if (service.logging?.driver !== "awslogs") throw new Error(`EC2 service must stream to CloudWatch Logs: $${name}`); } const postgres = config.services?.postgres; const backup = config.services?.["postgres-backup"]; for (const [name, service] of [["postgres", postgres], ["postgres-backup", backup]]) { if (!service) throw new Error(`Missing EC2 service: $${name}`); if (service.ports?.length) throw new Error(`EC2 database service must not publish ports: $${name}`); if (service.logging?.driver !== "awslogs") throw new Error(`EC2 database service must stream to CloudWatch Logs: $${name}`); } const trading = config.services["trading-rpc"]; const admin = config.services["admin-rpc"]; const tunnel = config.services.cloudflared; if (trading.environment?.DATABASE_URL !== "") throw new Error("EC2 database credential must not be an environment value"); if (!(trading.depends_on?.postgres)) throw new Error("EC2 trading-rpc must wait for Docker PostgreSQL"); if (postgres.environment?.POSTGRES_BACKUP_REPOSITORY_TYPE !== "r2") throw new Error("EC2 PostgreSQL must archive through pgBackRest to R2"); if (backup.environment?.POSTGRES_RESTORE_ROOT !== "/var/lib/postgres-backup/restores") throw new Error("EC2 restore drills require dedicated storage"); const restoreMount = (backup.volumes ?? []).find((mount) => mount.target === "/var/lib/postgres-backup/restores"); if (restoreMount?.source !== "/srv/vibe-rpc/restore-stage/restores") throw new Error("EC2 restore storage must use its dedicated EBS mount"); for (const key of ["ADMIN_AUTH_EMAIL_FILE", "ADMIN_AUTH_PASSWORD_FILE", "JWT_SECRET_FILE"]) { if (!admin.environment?.[key]?.startsWith("/run/secrets/")) throw new Error(`Admin secret must be file-backed: $${key}`); } if (admin.environment?.TRADING_RPC_GRPC_URL !== "http://trading-rpc:50051") throw new Error("EC2 admin-rpc must use private native gRPC"); if (!(trading.networks?.["trading-rpc-private"]?.aliases ?? []).includes("trading-rpc.internal")) throw new Error("Missing EC2 trading-rpc VPC alias"); if (!(admin.networks?.["admin-rpc-private"]?.aliases ?? []).includes("admin-rpc.internal")) throw new Error("Missing EC2 admin-rpc VPC alias"); if (!tunnel.image.includes("@sha256:")) throw new Error("EC2 cloudflared image must be digest-pinned"); for (const name of ["trading-rpc-private", "admin-rpc-private", "admin-rpc-internal", "trading-rpc-data"]) { if (config.networks?.[name]?.internal !== true) throw new Error(`EC2 private network must be internal: $${name}`); } });'
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
	@docker build --check -f $(DOCKER_DIR)/admin-rpc.Dockerfile .
	@docker build --check -f $(DOCKER_DIR)/trading-rpc.Dockerfile .
	@docker build --check -f $(DOCKER_DIR)/postgres.Dockerfile .
	@docker build --check -f $(DOCKER_DIR)/workspace-dev.Dockerfile .
