DOCKER_DIR := infras/docker
DOCKER_COMPOSE := docker compose -f $(DOCKER_DIR)/compose.yml
DOCKER_ENVIRONMENTS := development staging production

.PHONY: build-development
build-development: ## Build the development docker image.
	$(DOCKER_COMPOSE) -f $(DOCKER_DIR)/development/compose.yml build

.PHONY: start-development
start-development: ## Start the development docker container.
	$(DOCKER_COMPOSE) -f $(DOCKER_DIR)/development/compose.yml up -d

.PHONY: stop-development
stop-development: ## Stop the development docker container.
	$(DOCKER_COMPOSE) -f $(DOCKER_DIR)/development/compose.yml down

.PHONY: build-staging
build-staging: ## Build the staging docker image.
	$(DOCKER_COMPOSE) -f $(DOCKER_DIR)/staging/compose.yml build

.PHONY: start-staging
start-staging: ## Start the staging docker container.
	$(DOCKER_COMPOSE) -f $(DOCKER_DIR)/staging/compose.yml up -d

.PHONY: stop-staging
stop-staging: ## Stop the staging docker container.
	$(DOCKER_COMPOSE) -f $(DOCKER_DIR)/staging/compose.yml down

.PHONY: build-production
build-production: ## Build the production docker image.
	$(DOCKER_COMPOSE) -f $(DOCKER_DIR)/production/compose.yml build

.PHONY: start-production
start-production: ## Start the production docker container.
	$(DOCKER_COMPOSE) -f $(DOCKER_DIR)/production/compose.yml up -d

.PHONY: stop-production
stop-production: ## Stop the production docker container.
	$(DOCKER_COMPOSE) -f $(DOCKER_DIR)/production/compose.yml down

.PHONY: check-docker
check-docker: ## Validate Compose overlays, Dockerfiles, and the single-source layout.
	@set -eu; \
	for environment in $(DOCKER_ENVIRONMENTS); do \
		$(DOCKER_COMPOSE) -f "$(DOCKER_DIR)/$$environment/compose.yml" \
			config --no-env-resolution --quiet; \
	done
	@set -eu; \
	unexpected="$$(find . -type f \
		\( -name 'Dockerfile' -o -name '*.Dockerfile' -o -name 'Dockerfile.*' \) \
		! -path './infras/docker/*' \
		! -path './node_modules/*' \
		! -path './.git/*' -print)"; \
	if [ -n "$$unexpected" ]; then \
		echo "Dockerfiles outside $(DOCKER_DIR):" >&2; \
		echo "$$unexpected" >&2; \
		exit 1; \
	fi
	@docker build --check -f $(DOCKER_DIR)/dapp.Dockerfile .
	@docker build --check -f $(DOCKER_DIR)/trading-rpc.Dockerfile .
