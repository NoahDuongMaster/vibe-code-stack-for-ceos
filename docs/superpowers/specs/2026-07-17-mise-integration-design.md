# Mise Integration Design

**Date:** 2026-07-17
**Status:** Approved for implementation planning

## Summary

Integrate mise as the repository's shared toolchain and task entrypoint for local
development and GitHub Actions. Mise will manage Node.js and pnpm, expose a
small set of stable project tasks, and replace duplicated Node/pnpm setup steps
in CI. Existing pnpm scripts, Turborepo pipelines, Make targets, Docker builds,
and CI-only deployment controls remain the execution layers beneath mise.

This is an additive orchestration layer, not a rewrite of the repository's
build system.

## Goals

- Provide one committed toolchain definition for Node.js 22 and pnpm 11.2.2.
- Make a fresh checkout runnable through a predictable mise onboarding flow.
- Expose development and quality-gate commands through `mise run`.
- Use the same mise-managed toolchain in CI, Playwright, and deployment jobs.
- Preserve direct pnpm usage for ecosystem compatibility.
- Preserve the existing Docker, Turborepo, security, and deployment boundaries.

## Non-goals

- Replacing pnpm scripts, Turborepo, or Make with mise-native implementations.
- Managing PostgreSQL, Docker, Cloudflare credentials, or OS packages with mise.
- Loading application secrets or `.env` files through mise.
- Enabling local deployment commands or changing the CI-gated deployment model.
- Changing application behavior or workspace architecture.

## Current State

Toolchain declarations are distributed across several surfaces:

- `.nvmrc` selects Node.js 22 for nvm users.
- GitHub Actions selects Node.js 22 independently in each workflow.
- `package.json` pins `pnpm@11.2.2` and accepts Node.js `>=22.0.0`.
- Dockerfiles use Node.js 22 and Corepack independently.
- README and CONTRIBUTING onboarding instruct developers to enable Corepack and
  run pnpm directly.

There is no mise configuration today. The repository also contains unrelated
uncommitted work, so implementation must only touch the mise integration files
and the specific documentation/workflow sections identified by the plan.

## Chosen Approach

Mise will act as an orchestration facade:

```text
Developer or GitHub Actions
            |
            v
     mise toolchain/tasks
            |
            v
   pnpm scripts / Make targets
            |
            v
       Turbo / Docker
```

This keeps the existing commands useful outside mise while giving contributors
and CI one consistent entrypoint. It avoids duplicating build logic in TOML and
keeps deployment authority in GitHub Actions.

## Toolchain Configuration

Add a root `mise.toml` with:

- A hard minimum mise version of `2026.7.8`.
- Node.js requested as major version `22`.
- pnpm pinned to `11.2.2`, matching `package.json#packageManager`.
- Mise lockfile support enabled.
- Only explicit tools and tasks; no automatic secret or dotenv loading.

Commit `mise.lock` so the loose Node.js 22 request resolves to one reviewed
patch release and available tool artifacts are integrity-checked. CI must use
locked installation. Routine toolchain upgrades update the config or lockfile
in a reviewable commit.

Keep these compatibility declarations:

- `.nvmrc` remains `22` for nvm users.
- `package.json#packageManager` remains `pnpm@11.2.2`.
- `package.json#engines` continues to express the supported runtime range.
- Dockerfiles continue to pin their own runtime and package manager because
  image builds must not depend on mise being installed on the host.

Add `mise.local.toml` and `mise.*.local.toml` to `.gitignore` so personal
settings are never committed.

## Task Surface

Mise tasks delegate to existing commands rather than reproduce their logic.
The initial public task surface is:

| Task | Delegates to | Purpose |
| --- | --- | --- |
| `install` | `pnpm install --frozen-lockfile` | Install the committed dependency graph. |
| `dev` | `pnpm dev` | Start all application workspaces. |
| `dev:web` | `pnpm dev:web` | Start the dapp. |
| `dev:admin` | `pnpm dev:admin` | Start the admin SPA. |
| `dev:landing` | `pnpm dev:landing` | Start the landing site. |
| `dev:api` | `pnpm dev:api` | Start trading-rpc. |
| `dev:gateway` | `pnpm dev:gateway` | Start the API gateway. |
| `dev:backend` | `pnpm dev:backend` | Start both backend services. |
| `format` | `pnpm format` | Format repository files. |
| `check` | `pnpm check` | Apply Biome fixes and formatting. |
| `check:ci` | `pnpm check:ci` | Run the read-only Biome gate. |
| `typecheck` | `pnpm typecheck` | Run strict TypeScript checks. |
| `lint` | `pnpm lint` | Run workspace lint and architecture checks. |
| `test` | `pnpm test` | Run unit tests. |
| `test:e2e` | `pnpm test:e2e` | Run dapp Playwright tests. |
| `build` | `pnpm build` | Run production builds. |
| `verify` | quality commands in Definition-of-Done order | Run typecheck, read-only check, lint, test, then build sequentially. |
| `docker:start` | `make start-development` | Start the full Docker development environment. |
| `docker:stop` | `make stop-development` | Stop the full Docker development environment. |
| `docker:check` | `make check-docker` | Validate Docker definitions. |

Add a lightweight `toolchain:check` task that fails unless the active Node.js
major and pnpm version match the repository contract. The check must use only
the configured tools and standard shell/Node capabilities; it must not add a
dependency.

Task names remain explicit in documentation as `mise run <task>` instead of the
short command form, preventing future mise subcommand-name collisions.

## GitHub Actions Integration

Create a repository-local composite action under
`.github/actions/setup-toolchain/action.yml`. Every relevant job calls it after
checkout. The action will:

1. Install mise CLI `2026.7.8` with `jdx/mise-action@v4`.
2. Install tools from the committed config and `mise.lock` in locked mode.
3. Restore/cache the pnpm content-addressable store using the resolved store
   path and `pnpm-lock.yaml` hash.
4. Run the toolchain contract check before dependency installation.

The composite action removes repeated `pnpm/action-setup` and
`actions/setup-node` blocks from:

- `.github/workflows/ci.yml`
- `.github/workflows/playwright.yml`
- `.github/workflows/deploy.yml`

Standard CI gates use `mise run typecheck`, `mise run check:ci`,
`mise run lint`, `mise run test`, and `mise run build`. Protocol-specific,
Playwright setup, and deploy-specific pnpm commands remain direct commands after
the mise toolchain is active; they are not exposed as local deployment tasks.

The existing Turbo cache and Playwright browser cache remain unchanged. The
mise action cache covers installed tools, while the explicit pnpm cache covers
downloaded package content.

## Documentation and Onboarding

Update the root README and CONTRIBUTING guide so the primary flow is:

```bash
mise install
mise run install
mise run dev
```

Document how to install/activate mise by linking to its official installation
guide rather than embedding an OS-specific installer command. Explain that
direct `pnpm` commands remain supported and that `.nvmrc` is retained for nvm
compatibility.

Update the repository command reference in `AGENTS.md` to include the mise
entrypoint without removing the underlying pnpm commands agents may need for
targeted execution.

## Security and Failure Behavior

- Mise configuration must not read `.env` files or define secrets.
- GitHub Actions continue to receive secrets only through their existing scoped
  `env` mappings.
- Locked CI installation fails on tool version or integrity drift.
- Task failures propagate the delegated command's non-zero exit status.
- Local mise overrides are ignored by Git.
- No local task may invoke `wrangler deploy`, production Compose, or another
  deployment path.

## Verification

Implementation is complete when fresh evidence demonstrates:

1. `mise.toml` parses and lists the expected tasks.
2. `mise install --locked` succeeds from the committed lockfile.
3. `mise exec -- node --version` reports Node.js 22 and
   `mise exec -- pnpm --version` reports 11.2.2.
4. `mise run toolchain:check` succeeds with the locked toolchain, and its
   implementation explicitly checks both required version contracts.
5. The local composite action syntax and all edited workflow YAML parse.
6. GitHub workflow jobs no longer contain duplicate Node/pnpm setup pairs.
7. Documentation consistently presents mise as the primary onboarding path.
8. `mise run typecheck`, `mise run check:ci`, `mise run lint`, and
   `mise run test` pass.
9. `mise run build` passes because build-relevant workflow/configuration files
   are changed.

If a full gate cannot run because of an unrelated pre-existing worktree change,
the implementation report must name the exact command, failure, and evidence
that the failure is unrelated. Mise-specific validation must still be green.

## References

- [mise configuration](https://mise.jdx.dev/configuration.html)
- [mise lockfile](https://mise.jdx.dev/dev-tools/mise-lock.html)
- [mise tasks](https://mise.jdx.dev/tasks/)
- [mise continuous integration](https://mise.jdx.dev/continuous-integration.html)
- [jdx/mise-action](https://github.com/jdx/mise-action)
