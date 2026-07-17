# Mise-Only Workflow Design

**Date:** 2026-07-17

## Summary

Make mise the only documented and CI-supported command interface for repository
setup, development, validation, and builds. Keep pnpm as an implementation
detail because it still owns JavaScript dependency resolution, workspace
execution, lifecycle scripts, and `pnpm-lock.yaml`.

The intended command flow is:

```text
Developer or CI
  -> mise task
  -> mise-managed Node.js and pnpm
  -> internal root package script
  -> Turborepo or workspace package script
```

## Goals

- Give developers one command namespace: `mise`.
- Make one command, `mise setup`, install both the locked toolchain and project
  dependencies.
- Route development, checks, tests, and builds through mise by default.
- Preserve familiar root pnpm commands as compatibility shims that delegate to
  mise instead of bypassing it.
- Reject a direct `pnpm install` that is not running inside the approved mise
  setup task.
- Make CI dependency installation and quality gates use the same mise tasks as
  local development.
- Avoid recursion between mise tasks and root package scripts.

## Non-goals

- Removing pnpm, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, or the root
  `packageManager` declaration.
- Replacing pnpm with npm, Yarn, Bun, or another JavaScript package manager.
- Rewriting workspace-local package scripts that Turborepo invokes internally.
- Preventing a developer with write access from deliberately modifying or
  bypassing repository policy.
- Changing deployment triggers, environment gates, or deployment commands.

## Public Command Contract

The documented interface becomes:

| Command | Responsibility |
| --- | --- |
| `mise setup` | Install locked tools automatically, then install frozen dependencies |
| `mise dev` | Start every development workspace |
| `mise dev:web` | Start the dapp |
| `mise dev:admin` | Start the admin SPA |
| `mise dev:landing` | Start the landing site |
| `mise dev:api` | Start trading-rpc |
| `mise dev:gateway` | Start the API gateway |
| `mise dev:backend` | Start both backend services |
| `mise format` | Format repository files |
| `mise check` | Apply Biome fixes and formatting |
| `mise check:ci` | Run the read-only Biome gate |
| `mise typecheck` | Run strict TypeScript checks |
| `mise lint` | Run lint and architecture checks |
| `mise test` | Run toolchain and workspace unit tests |
| `mise test:e2e` | Run Playwright tests |
| `mise build` | Run production builds |
| `mise verify` | Run all definition-of-done gates sequentially |
| `mise docker:start` | Start the Docker development environment |
| `mise docker:stop` | Stop the Docker development environment |
| `mise docker:check` | Validate Docker definitions |

The short `mise <task>` form is preferred in documentation. `mise run <task>`
remains valid and equivalent.

## Root Script Routing

Root package scripts are divided into public compatibility shims and internal
execution scripts.

Examples:

```json
{
  "scripts": {
    "dev": "mise dev",
    "internal:dev": "turbo run dev",
    "test": "mise test",
    "internal:test": "node --test scripts/check-toolchain.test.mjs && turbo run test"
  }
}
```

Mise tasks backed by root package scripts call only `internal:*` scripts.
Setup and Docker tasks continue to call pnpm installation and Make directly.
Public pnpm scripts call mise. This creates two acyclic flows:

```text
mise dev -> pnpm internal:dev -> turbo run dev
pnpm dev -> mise dev -> pnpm internal:dev -> turbo run dev
```

The compatibility shims protect existing muscle memory and external tooling
while ensuring the actual command executes with the locked mise toolchain.

The routing applies to root scripts represented by mise tasks: development,
formatting, checks, typechecking, linting, tests, and builds. Specialized root
scripts without a mise task remain direct until they are intentionally added to
the public mise contract.

## Dependency Installation Guard

Rename the current mise `install` task to `setup`. A mise task automatically
prepares its configured tools, so `mise setup` is sufficient for a fresh clone:

```text
mise setup
  -> install locked Node.js and pnpm when absent
  -> run pnpm install --frozen-lockfile
```

Add a dependency-free Node.js guard to the root `preinstall` lifecycle. It
accepts installation only when `MISE_TASK_NAME` is `setup`. Otherwise it exits
non-zero with a concise message:

```text
Run `mise setup` instead of `pnpm install`.
```

`MISE_TASK_NAME` is supplied by mise to task processes. Checking the task name,
rather than a project-wide environment variable, also rejects direct installs
from an activated mise shell.

This guard is repository policy, not a security boundary. A caller can still
use pnpm flags that suppress lifecycle scripts or modify the repository.
CI remains the authoritative enforcement boundary.

## Mise Task Composition

Each mise task backed by a root package script invokes its matching
`internal:*` script. Setup and Docker tasks are explicit exceptions. The
`verify` task composes mise tasks rather than directly calling public pnpm
scripts. Its gates remain sequential:

1. `typecheck`
2. `check:ci`
3. `lint`
4. `test`
5. `build`

Task references or nested `mise` calls must preserve fail-fast behavior: the
first failed gate terminates `verify` with a non-zero exit code.

## CI Integration

The local composite action remains responsible for installing the locked mise
release and restoring caches. Its order becomes:

1. Install mise and the locked toolchain.
2. Resolve and restore the pnpm store cache.
3. Run `mise setup` to install frozen dependencies.
4. Run the toolchain contract check.

Workflow jobs remove their repeated direct `pnpm install --frozen-lockfile`
steps. Standard gates continue through mise tasks. Specialized commands such as
security audits, protocol breaking-change checks, and deployment commands may
remain direct pnpm commands when they are implementation details rather than
the public developer workflow.

Deployment workflow triggers, approval gates, environment selection, and
deployment commands do not change.

## Error Handling

- Direct dependency installation fails with the exact replacement command.
- A missing mise executable in a pnpm compatibility shim fails naturally; the
  onboarding documentation provides the mise installation instructions.
- Toolchain mismatches continue to fail through `toolchain:check`.
- Mise task failures preserve the underlying command exit code.
- CI fails before quality gates when setup or toolchain verification fails.

## Documentation

Update `README.md`, `CONTRIBUTING.md`, and the command section of `AGENTS.md` to:

- use `mise setup` for first-time setup;
- prefer the short `mise <task>` form;
- describe pnpm as an internal package/workspace engine;
- stop presenting direct pnpm commands as a general compatibility interface;
- retain targeted pnpm examples only where no mise task exists.

## Testing Strategy

Follow test-first implementation for behavior changes.

1. Add unit tests for the install guard:
   - accepts `MISE_TASK_NAME=setup`;
   - rejects a missing task name;
   - rejects an unrelated mise task;
   - returns the documented replacement command.
2. Add a routing contract test that verifies:
   - public root scripts delegate to mise;
   - matching mise tasks invoke `internal:*` scripts;
   - internal scripts never invoke mise;
   - the setup task invokes frozen dependency installation.
3. Run the toolchain validator tests.
4. Parse the composite action and workflows as YAML.
5. Verify workflows no longer contain repeated dependency-install steps.
6. Run `mise setup`, task listing, and representative command-routing smoke
   checks.
7. Run `mise verify` and require every definition-of-done gate to pass.

## Acceptance Criteria

- A fresh clone can be prepared with only `mise setup` after mise itself is
  installed.
- `mise dev` starts the same Turborepo development graph as the former root
  `pnpm dev` implementation.
- `pnpm dev` delegates to `mise dev` without recursion.
- Direct `pnpm install` fails outside `mise setup` with an actionable message.
- CI installs dependencies through the shared mise setup path.
- Standard CI gates and local verification use the same mise tasks.
- All existing definition-of-done gates pass.
- Existing unrelated worktree changes remain untouched.

## Risks and Mitigations

- **Recursive task routing:** separate public shims from `internal:*` scripts and
  test the routing graph statically.
- **Third-party tooling calls a public pnpm script:** compatibility shims retain
  those entrypoints and route them through mise.
- **Lifecycle scripts are bypassed:** treat CI as authoritative and keep local
  enforcement explicitly best-effort.
- **CI cache regression:** restore the pnpm store before `mise setup` and retain
  the existing cache key contract.
- **Documentation drift:** keep mise task names centralized in `mise.toml` and
  validate representative routing in tests.
