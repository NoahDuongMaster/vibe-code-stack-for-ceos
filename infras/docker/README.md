# Docker infrastructure

This directory is the repository's single source of truth for Docker build and
Compose configuration. Application and service workspaces must not own separate
Dockerfiles.

## Layout

- `dapp.Dockerfile` builds the vinext standalone dapp image.
- `trading-rpc.Dockerfile` builds the Fastify/Connect-RPC service image.
- `compose.yml` contains environment-independent dapp build configuration.
- `{development,staging,production}/compose.yml` contain only environment
  overrides: image tag, public build arguments, host port, and runtime env file.

Compose paths are resolved from `infras/docker/compose.yml`, which must be the
first `-f` argument:

```bash
docker compose \
  -f infras/docker/compose.yml \
  -f infras/docker/development/compose.yml \
  up --build
```

Use the root `Makefile` targets for normal operation. Run `make check-docker`
after changing Docker configuration.
