# Mise Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make mise the shared Node.js/pnpm toolchain and task entrypoint for local development and GitHub Actions without replacing pnpm, Turborepo, Make, Docker, or CI-only deployment controls.

**Architecture:** A root `mise.toml` owns tool versions and delegates stable tasks to existing pnpm scripts and Make targets. A repository-local composite GitHub Action installs the locked mise toolchain and restores the pnpm store, while workflows consume that action instead of duplicating Node/pnpm setup. Compatibility files and direct pnpm commands remain supported.

**Tech Stack:** mise 2026.7.8, Node.js 22, pnpm 11.2.2, TOML, Node.js built-in test runner, GitHub composite actions, GitHub Actions, Turborepo, Make.

## Global Constraints

- Use mise `2026.7.8` as the hard minimum and the pinned CI CLI version.
- Request Node.js major `22`; commit `mise.lock` to lock its resolved patch version.
- Pin pnpm exactly to `11.2.2`, matching `package.json#packageManager`.
- Add no dependency and do not replace pnpm scripts, Turborepo, or Make.
- Do not load `.env` files or secrets through mise.
- Do not add a local task that deploys, invokes `wrangler deploy`, or starts production Compose.
- Keep `.nvmrc`, `package.json#packageManager`, `package.json#engines`, and Docker runtime pins as compatibility boundaries.
- Preserve all unrelated worktree changes; every commit names only files owned by its task.
- Run quality gates sequentially in this order: typecheck, read-only Biome check, lint, test, build.

## File Map

| File | Responsibility |
| --- | --- |
| `mise.toml` | Tool versions, safe task wrappers, and sequential verification entrypoint. |
| `mise.lock` | Exact resolved tool versions and available integrity metadata. |
| `scripts/check-toolchain.mjs` | Validate the active Node.js and pnpm versions against repository declarations. |
| `scripts/check-toolchain.test.mjs` | Lock the validator's matching and mismatch behavior. |
| `package.json` | Include the toolchain validator tests in the root test gate. |
| `.gitignore` | Exclude developer-specific mise override files. |
| `.github/actions/setup-toolchain/action.yml` | Install locked mise tools and restore the pnpm store for every workflow job. |
| `.github/workflows/ci.yml` | Consume the composite action and run standard gates through mise tasks. |
| `.github/workflows/playwright.yml` | Consume the composite action before Playwright setup and execution. |
| `.github/workflows/deploy.yml` | Consume the composite action while preserving direct CI-only deploy commands. |
| `README.md` | Make mise the primary onboarding and command surface for users. |
| `CONTRIBUTING.md` | Make mise the contributor setup path and document pnpm/nvm compatibility. |
| `AGENTS.md` | Add mise commands to the agent control surface while retaining targeted pnpm commands. |

---

### Task 1: Add the locked mise toolchain and tested version contract

**Files:**
- Create: `mise.toml`
- Create: `mise.lock`
- Create: `scripts/check-toolchain.mjs`
- Create: `scripts/check-toolchain.test.mjs`
- Modify: `package.json:34-60`
- Modify: `.gitignore:56-64`

**Interfaces:**
- Consumes: `.nvmrc` containing the supported Node.js major and `package.json#packageManager` containing `pnpm@<version>`.
- Produces: `validateToolchain(input): string[]`, `checkToolchain(rootDir?): { nodeVersion: string; pnpmVersion: string }`, the `mise run toolchain:check` contract, and all public mise tasks consumed by later tasks.

- [ ] **Step 1: Write the failing validator tests**

Create `scripts/check-toolchain.test.mjs`:

```javascript
import assert from 'node:assert/strict';
import test from 'node:test';

import { validateToolchain } from './check-toolchain.mjs';

const MATCHING_TOOLCHAIN = {
  actualNodeVersion: 'v22.18.0',
  actualPnpmVersion: '11.2.2',
  expectedNodeMajor: '22',
  packageManager: 'pnpm@11.2.2',
};

test('should accept matching Node.js and pnpm versions', () => {
  assert.deepEqual(validateToolchain(MATCHING_TOOLCHAIN), []);
});

test('should reject a Node.js major when it differs from .nvmrc', () => {
  assert.deepEqual(
    validateToolchain({
      ...MATCHING_TOOLCHAIN,
      actualNodeVersion: 'v24.12.0',
    }),
    ['Node.js major mismatch: expected 22, received v24.12.0'],
  );
});

test('should reject pnpm when it differs from packageManager', () => {
  assert.deepEqual(
    validateToolchain({
      ...MATCHING_TOOLCHAIN,
      actualPnpmVersion: '11.3.0',
    }),
    ['pnpm version mismatch: expected 11.2.2, received 11.3.0'],
  );
});

test('should reject packageManager when it does not declare pnpm', () => {
  assert.deepEqual(
    validateToolchain({
      ...MATCHING_TOOLCHAIN,
      packageManager: 'npm@11.4.2',
    }),
    ['packageManager must declare pnpm@<version>, received npm@11.4.2'],
  );
});
```

- [ ] **Step 2: Run the tests and verify the missing implementation failure**

Run:

```bash
node --test scripts/check-toolchain.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `scripts/check-toolchain.mjs`.

- [ ] **Step 3: Implement the toolchain validator**

Create `scripts/check-toolchain.mjs`:

```javascript
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const validateToolchain = ({
  actualNodeVersion,
  actualPnpmVersion,
  expectedNodeMajor,
  packageManager,
}) => {
  const errors = [];
  const actualNodeMajor = actualNodeVersion.replace(/^v/, '').split('.')[0];

  if (actualNodeMajor !== expectedNodeMajor) {
    errors.push(
      `Node.js major mismatch: expected ${expectedNodeMajor}, received ${actualNodeVersion}`,
    );
  }

  const pnpmDeclaration = /^pnpm@([^+]+)(?:\+.+)?$/.exec(packageManager);
  if (!pnpmDeclaration) {
    errors.push(
      `packageManager must declare pnpm@<version>, received ${packageManager}`,
    );
  } else if (actualPnpmVersion !== pnpmDeclaration[1]) {
    errors.push(
      `pnpm version mismatch: expected ${pnpmDeclaration[1]}, received ${actualPnpmVersion}`,
    );
  }

  return errors;
};

const readContract = (rootDir) => {
  const packageJson = JSON.parse(
    readFileSync(resolve(rootDir, 'package.json'), 'utf8'),
  );

  return {
    expectedNodeMajor: readFileSync(resolve(rootDir, '.nvmrc'), 'utf8').trim(),
    packageManager: packageJson.packageManager,
  };
};

const readPnpmVersion = () => {
  const result = spawnSync('pnpm', ['--version'], { encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || 'pnpm --version failed');
  }
  return result.stdout.trim();
};

export const checkToolchain = (rootDir = ROOT_DIR) => {
  const active = {
    actualNodeVersion: process.version,
    actualPnpmVersion: readPnpmVersion(),
  };
  const errors = validateToolchain({ ...active, ...readContract(rootDir) });
  if (errors.length > 0) throw new Error(errors.join('\n'));

  return {
    nodeVersion: active.actualNodeVersion,
    pnpmVersion: active.actualPnpmVersion,
  };
};

const mainModule = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : undefined;

if (import.meta.url === mainModule) {
  try {
    const active = checkToolchain();
    process.stdout.write(
      `Toolchain OK: Node.js ${active.nodeVersion}, pnpm ${active.pnpmVersion}\n`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}
```

- [ ] **Step 4: Run the focused tests and verify all four behaviors pass**

Run:

```bash
node --test scripts/check-toolchain.test.mjs
```

Expected: 4 tests pass, 0 fail.

- [ ] **Step 5: Add root test coverage and ignore local mise overrides**

In `package.json`, replace the root test script with:

```json
"test": "node --test scripts/check-toolchain.test.mjs && turbo run test"
```

Add this block after the AI local settings block in `.gitignore`:

```gitignore
# mise local settings (user-specific, not shared)
mise.local.toml
mise.*.local.toml
```

- [ ] **Step 6: Add the complete mise configuration**

Create `mise.toml`:

```toml
min_version = "2026.7.8"

[tools]
node = "22"
pnpm = "11.2.2"

[settings]
lockfile = true

[tasks.install]
description = "Install dependencies from the committed pnpm lockfile"
run = "pnpm install --frozen-lockfile"

[tasks.dev]
description = "Start all application workspaces"
run = "pnpm dev"

[tasks."dev:web"]
description = "Start the dapp"
run = "pnpm dev:web"

[tasks."dev:admin"]
description = "Start the admin SPA"
run = "pnpm dev:admin"

[tasks."dev:landing"]
description = "Start the landing site"
run = "pnpm dev:landing"

[tasks."dev:api"]
description = "Start trading-rpc"
run = "pnpm dev:api"

[tasks."dev:gateway"]
description = "Start the API gateway"
run = "pnpm dev:gateway"

[tasks."dev:backend"]
description = "Start both backend services"
run = "pnpm dev:backend"

[tasks.format]
description = "Format repository files"
run = "pnpm format"

[tasks.check]
description = "Apply Biome fixes and formatting"
run = "pnpm check"

[tasks."check:ci"]
description = "Run the read-only Biome gate"
run = "pnpm check:ci"

[tasks.typecheck]
description = "Run strict TypeScript checks"
run = "pnpm typecheck"

[tasks.lint]
description = "Run lint and architecture checks"
run = "pnpm lint"

[tasks.test]
description = "Run repository unit tests"
run = "pnpm test"

[tasks."test:e2e"]
description = "Run dapp Playwright tests"
run = "pnpm test:e2e"

[tasks.build]
description = "Run production builds"
run = "pnpm build"

[tasks."toolchain:check"]
description = "Verify active Node.js and pnpm versions"
run = "node scripts/check-toolchain.mjs"

[tasks.verify]
description = "Run every definition-of-done gate sequentially"
run = """
set -eu
pnpm typecheck
pnpm check:ci
pnpm lint
pnpm test
pnpm build
"""

[tasks."docker:start"]
description = "Start the full Docker development environment"
run = "make start-development"

[tasks."docker:stop"]
description = "Stop the full Docker development environment"
run = "make stop-development"

[tasks."docker:check"]
description = "Validate Docker definitions"
run = "make check-docker"
```

- [ ] **Step 7: Bootstrap an isolated mise CLI and generate the committed lockfile**

Run:

```bash
mise_test_root="$PWD/.cache/mise-integration"
test ! -e "$mise_test_root"
mkdir -p "$mise_test_root"
export MISE_DATA_DIR="$mise_test_root/data"
export MISE_CACHE_DIR="$mise_test_root/cache"
export MISE_STATE_DIR="$mise_test_root/state"
export MISE_CONFIG_DIR="$mise_test_root/config"
curl -fsSL https://mise.run | \
  MISE_VERSION=v2026.7.8 MISE_INSTALL_PATH="$mise_test_root/mise" sh
"$mise_test_root/mise" trust mise.toml
"$mise_test_root/mise" lock \
  --platform linux-x64,linux-arm64,macos-x64,macos-arm64
"$mise_test_root/mise" install --locked
```

Expected: mise 2026.7.8 creates `mise.lock` entries for CI Linux and supported macOS/Linux development architectures, then installs Node.js 22 and pnpm 11.2.2 without an unlocked metadata fallback. `.cache/mise-integration` remains ignored and isolated from the user's global mise state.

- [ ] **Step 8: Validate the task surface and active versions**

Run:

```bash
mise_test_root="$PWD/.cache/mise-integration"
export MISE_DATA_DIR="$mise_test_root/data"
export MISE_CACHE_DIR="$mise_test_root/cache"
export MISE_STATE_DIR="$mise_test_root/state"
export MISE_CONFIG_DIR="$mise_test_root/config"
"$mise_test_root/mise" tasks ls
"$mise_test_root/mise" run toolchain:check
"$mise_test_root/mise" exec -- node --version
"$mise_test_root/mise" exec -- pnpm --version
```

Expected: the task list contains every task from `mise.toml`; the contract check exits 0; Node.js reports `v22.*`; pnpm reports `11.2.2`.

- [ ] **Step 9: Run formatting checks and commit the toolchain unit**

Run:

```bash
mise_test_root="$PWD/.cache/mise-integration"
export MISE_DATA_DIR="$mise_test_root/data"
export MISE_CACHE_DIR="$mise_test_root/cache"
export MISE_STATE_DIR="$mise_test_root/state"
export MISE_CONFIG_DIR="$mise_test_root/config"
"$mise_test_root/mise" fmt --check
"$mise_test_root/mise" exec -- pnpm exec biome check \
  package.json scripts/check-toolchain.mjs \
  scripts/check-toolchain.test.mjs
git diff --check -- mise.toml mise.lock package.json .gitignore \
  scripts/check-toolchain.mjs scripts/check-toolchain.test.mjs
git add -- mise.toml mise.lock package.json .gitignore \
  scripts/check-toolchain.mjs scripts/check-toolchain.test.mjs
git commit --only -m "build(infra): add mise toolchain" -- \
  mise.toml mise.lock package.json .gitignore scripts/check-toolchain.mjs \
  scripts/check-toolchain.test.mjs
```

Expected: Biome and `git diff --check` pass; the commit contains only the six listed files.

---

### Task 2: Replace duplicated GitHub toolchain setup with one composite action

**Files:**
- Create: `.github/actions/setup-toolchain/action.yml`
- Modify: `.github/workflows/ci.yml:7-213`
- Modify: `.github/workflows/playwright.yml:36-42`
- Modify: `.github/workflows/deploy.yml:12-126`

**Interfaces:**
- Consumes: `mise.toml`, `mise.lock`, `mise run toolchain:check`, and `pnpm-lock.yaml`.
- Produces: a checkout-relative `./.github/actions/setup-toolchain` action that leaves locked Node.js and pnpm binaries on `PATH` and restores the pnpm store.

- [ ] **Step 1: Capture the failing duplication contract**

Run:

```bash
rg -n 'pnpm/action-setup|actions/setup-node|NODE_VERSION' \
  .github/workflows/ci.yml \
  .github/workflows/playwright.yml \
  .github/workflows/deploy.yml
```

Expected: FAIL the desired contract by printing the existing repeated setup actions and Node version declarations.

- [ ] **Step 2: Create the composite toolchain action**

Create `.github/actions/setup-toolchain/action.yml`:

```yaml
name: Setup mise toolchain
description: Install the locked project tools and restore the pnpm store

runs:
  using: composite
  steps:
    - name: Install mise toolchain
      uses: jdx/mise-action@v4
      with:
        version: 2026.7.8
        install_args: --locked
        cache: true

    - name: Verify toolchain contract
      shell: bash
      run: mise run toolchain:check

    - name: Resolve pnpm store path
      id: pnpm-store
      shell: bash
      run: echo "path=$(pnpm store path --silent)" >> "$GITHUB_OUTPUT"

    - name: Restore pnpm store
      uses: actions/cache@v4
      with:
        path: ${{ steps.pnpm-store.outputs.path }}
        key: ${{ runner.os }}-${{ runner.arch }}-pnpm-${{ hashFiles('pnpm-lock.yaml') }}
        restore-keys: |
          ${{ runner.os }}-${{ runner.arch }}-pnpm-
```

- [ ] **Step 3: Migrate every workflow job to the composite action**

Delete the top-level `NODE_VERSION` blocks from `ci.yml` and `deploy.yml`.

In all six `ci.yml` jobs (`typecheck`, `lint`, `test`, `security`, `protocol`, and `build`), replace each Node/pnpm setup pair with:

```yaml
      - name: Setup toolchain
        uses: ./.github/actions/setup-toolchain
```

In both `deploy.yml` jobs (`deploy-staging` and `deploy-production`), use the same replacement after checkout. Do not change any build/deploy command or secret mapping.

In the single `playwright.yml` job, use the same replacement after checkout. Do not change browser caching, environment-file generation, build, test, or artifact steps.

- [ ] **Step 4: Route standard CI gates through mise tasks**

Make these exact replacements in `.github/workflows/ci.yml`:

```yaml
# Type Check job
- name: Type check
  run: mise run typecheck

# Lint job
- name: Biome check
  run: mise run check:ci

- name: ESLint
  run: mise run lint

# Unit Tests job
- name: Run tests
  run: mise run test

# Build job; preserve its existing env mapping
- name: Build
  run: mise run build
```

Keep security audit and protocol-specific pnpm commands direct because they are specialized CI commands, not standard project tasks.

- [ ] **Step 5: Verify workflow structure and removal of legacy setup**

Run:

```bash
if rg -n 'pnpm/action-setup|actions/setup-node|NODE_VERSION' \
  .github/workflows/ci.yml \
  .github/workflows/playwright.yml \
  .github/workflows/deploy.yml; then
  exit 1
fi
ruby -e 'require "yaml"; ARGV.each { |path| Psych.parse_file(path) }' \
  .github/actions/setup-toolchain/action.yml \
  .github/workflows/ci.yml \
  .github/workflows/playwright.yml \
  .github/workflows/deploy.yml
git diff --check -- .github/actions/setup-toolchain/action.yml \
  .github/workflows/ci.yml .github/workflows/playwright.yml \
  .github/workflows/deploy.yml
```

Expected: no legacy setup match; Ruby/Psych parses all four YAML files; `git diff --check` exits 0. The full repository Biome gate runs in Task 4.

- [ ] **Step 6: Review the deployment boundary and commit the CI unit**

Run:

```bash
rg -n 'wrangler deploy|wrangler pages deploy|environment: (staging|production)' \
  .github/workflows/deploy.yml
if rg -n 'wrangler deploy|wrangler pages deploy|deploy:' mise.toml; then
  exit 1
fi
git add -- .github/actions/setup-toolchain/action.yml \
  .github/workflows/ci.yml .github/workflows/playwright.yml \
  .github/workflows/deploy.yml
git commit --only -m "ci(infra): provision tools with mise" -- \
  .github/actions/setup-toolchain/action.yml .github/workflows/ci.yml \
  .github/workflows/playwright.yml .github/workflows/deploy.yml
```

Expected: deployment commands and environment gates remain only in `deploy.yml`; `mise.toml` exposes no deployment task; the commit contains only the four workflow/action files.

---

### Task 3: Make mise the documented onboarding and command surface

**Files:**
- Modify: `README.md:252-290`
- Modify: `README.md:380-391`
- Modify: `CONTRIBUTING.md:31-40`
- Modify: `AGENTS.md:56-86`

**Interfaces:**
- Consumes: the task names defined in `mise.toml`.
- Produces: one consistent user, contributor, and agent command contract based on `mise run <task>` with direct pnpm support retained for targeted commands.

- [ ] **Step 1: Capture documentation that still treats Corepack/pnpm as onboarding**

Run:

```bash
rg -n 'corepack enable|# Install \(pnpm|pnpm dev|pnpm typecheck|pnpm check:ci' \
  README.md CONTRIBUTING.md AGENTS.md
```

Expected: prints the old onboarding and primary command references.

- [ ] **Step 2: Rewrite README Quick Start around mise**

Immediately before the Quick Start code block, add:

```markdown
Install and activate [mise](https://mise.jdx.dev/installing-mise.html) first.
The repository keeps `.nvmrc` and direct pnpm scripts for compatibility, but
mise is the primary toolchain and task entrypoint.
```

Use this setup/command content in the Quick Start code block:

```bash
# Clone
git clone https://github.com/NoahDuongMaster/vibe-code-stack-for-ceos.git
cd vibe-code-stack-for-ceos

# Install the locked Node.js/pnpm toolchain and dependencies
mise install
mise run install

# Start the whole company
mise run dev

# …or one department
mise run dev:web        # Next.js app      → http://localhost:3000
mise run dev:admin      # React admin SPA
mise run dev:landing    # Astro landing
mise run dev:api        # Connect-RPC Node backend
mise run dev:gateway    # Gateway → real development VPC → trading-rpc
mise run dev:backend    # Gateway VPC mode + direct local trading-rpc process
```

In the VPC development section, change the gateway command and its explanatory reference from `pnpm dev:gateway` to `mise run dev:gateway`.

- [ ] **Step 3: Replace the README command table with the public mise surface**

Use this table and note under `## 📜 All Scripts`:

```markdown
| Command (repo root) | What it does |
| --- | --- |
| `mise run install` | Install dependencies from the committed pnpm lockfile |
| `mise run dev` | Start every app through Turborepo |
| `mise run dev:web` / `dev:admin` / `dev:landing` / `dev:api` / `dev:gateway` | Start one workspace |
| `mise run dev:backend` | Start the local gateway and trading-rpc together |
| `mise run build` | Build every workspace |
| `mise run typecheck` | Run TypeScript checks across all workspaces |
| `mise run lint` | Run ESLint, Biome, buf, and architecture checks |
| `mise run check` / `check:ci` / `format` | Apply Biome fixes / run the read-only gate / format files |
| `mise run test` | Run toolchain and workspace unit tests |
| `mise run test:e2e` | Run dapp Playwright tests |
| `mise run verify` | Run every definition-of-done gate sequentially |
| `mise run docker:start` / `docker:stop` / `docker:check` | Operate or validate the Docker development environment |

Direct pnpm scripts remain supported for ecosystem tooling and targeted
workspace commands. Deployment remains GitHub Actions-only.
```

- [ ] **Step 4: Update contributor onboarding**

Replace the Development Setup block and following paragraph in `CONTRIBUTING.md` with:

````markdown
Install and activate [mise](https://mise.jdx.dev/installing-mise.html), then run:

```bash
mise install
mise run install
mise run dev            # starts every app in the monorepo through Turborepo
```

See the root [`README.md`](README.md) for per-app mise tasks and the
[Docker environments](README.md) section for containerized setup. Direct pnpm
commands remain supported, and `.nvmrc` remains available for nvm users.
````

- [ ] **Step 5: Update the AGENTS.md command and completion contracts**

Replace the initial command block with:

```bash
mise install                  # install locked Node.js 22 + pnpm 11.2.2
mise run install              # pnpm install --frozen-lockfile

mise run dev                  # all apps
mise run dev:web | dev:admin | dev:landing | dev:api    # one app

mise run typecheck            # tsc --noEmit, all 8 workspaces
mise run check:ci             # Biome (read-only), whole repo
mise run lint                 # ESLint / Biome / buf / architecture checks
mise run test                 # root toolchain + workspace tests
mise run build                # production builds
mise run check                # Biome auto-fix + format
mise run verify               # all definition-of-done gates, sequentially

# Direct pnpm remains supported for targeted execution.
pnpm --filter @apps/dapp test
pnpm --filter @apps/dapp exec vitest run <path-to-test-file>
pnpm test:e2e
```

Replace the Definition of Done checklist commands with:

```markdown
- [ ] `mise run typecheck` — zero errors
- [ ] `mise run check:ci` — zero errors
- [ ] `mise run lint` — zero errors
- [ ] `mise run test` — all pass; new logic has tests
- [ ] `mise run build` — if you touched build-relevant code or config
```

- [ ] **Step 6: Verify documentation consistency and commit the docs unit**

Run:

```bash
if rg -n 'corepack enable|# Install \(pnpm' README.md CONTRIBUTING.md; then
  exit 1
fi
rg -n 'mise install|mise run install|mise run dev|mise run verify' \
  README.md CONTRIBUTING.md AGENTS.md
git diff --check -- README.md CONTRIBUTING.md AGENTS.md
git add -- README.md CONTRIBUTING.md AGENTS.md
git commit --only -m "docs(infra): document mise workflow" -- \
  README.md CONTRIBUTING.md AGENTS.md
```

Expected: legacy onboarding is absent; each document contains its required mise commands; whitespace checks pass; the commit contains only the three documentation files. The full repository Biome gate runs in Task 4.

---

### Task 4: Run the complete integration verification

**Files:**
- Verify only; modify only a mise-owned file when a validation failure proves that file is incorrect.

**Interfaces:**
- Consumes: all files and commands produced by Tasks 1-3.
- Produces: fresh evidence for toolchain reproducibility, workflow migration, documentation consistency, and all repository gates.

- [ ] **Step 1: Audit the final mise-owned diff and worktree isolation**

Run:

```bash
git status --short
git log -4 --oneline --decorate
git diff --check -- mise.toml mise.lock package.json .gitignore \
  scripts/check-toolchain.mjs scripts/check-toolchain.test.mjs \
  .github/actions/setup-toolchain/action.yml .github/workflows/ci.yml \
  .github/workflows/playwright.yml .github/workflows/deploy.yml \
  README.md CONTRIBUTING.md AGENTS.md
```

Expected: the three implementation commits are present; unrelated pre-existing changes remain uncommitted and untouched; no whitespace error is reported.

- [ ] **Step 2: Reinstall from the committed lock and verify exact tools**

Run:

```bash
mise_test_root="$PWD/.cache/mise-integration"
export MISE_DATA_DIR="$mise_test_root/data"
export MISE_CACHE_DIR="$mise_test_root/cache"
export MISE_STATE_DIR="$mise_test_root/state"
export MISE_CONFIG_DIR="$mise_test_root/config"
"$mise_test_root/mise" install --locked
"$mise_test_root/mise" run toolchain:check
"$mise_test_root/mise" exec -- node --version
"$mise_test_root/mise" exec -- pnpm --version
```

Expected: locked installation exits 0; Node.js is `v22.*`; pnpm is exactly `11.2.2`.

- [ ] **Step 3: Re-run focused integration contracts**

Run:

```bash
mise_test_root="$PWD/.cache/mise-integration"
export MISE_DATA_DIR="$mise_test_root/data"
export MISE_CACHE_DIR="$mise_test_root/cache"
export MISE_STATE_DIR="$mise_test_root/state"
export MISE_CONFIG_DIR="$mise_test_root/config"
"$mise_test_root/mise" exec -- node --test scripts/check-toolchain.test.mjs
if rg -n 'pnpm/action-setup|actions/setup-node|NODE_VERSION' \
  .github/workflows/ci.yml \
  .github/workflows/playwright.yml \
  .github/workflows/deploy.yml; then
  exit 1
fi
if rg -n 'wrangler deploy|wrangler pages deploy|deploy:' mise.toml; then
  exit 1
fi
```

Expected: 4 validator tests pass; no legacy workflow setup remains; no local deploy task exists.

- [ ] **Step 4: Run all definition-of-done gates sequentially**

Run:

```bash
mise_test_root="$PWD/.cache/mise-integration"
export MISE_DATA_DIR="$mise_test_root/data"
export MISE_CACHE_DIR="$mise_test_root/cache"
export MISE_STATE_DIR="$mise_test_root/state"
export MISE_CONFIG_DIR="$mise_test_root/config"
"$mise_test_root/mise" run verify
```

Expected: typecheck, `check:ci`, lint, test, and build all pass in order.

If a gate fails, inspect and correct only failures caused by the mise-owned files. For a failure caused by an unrelated pre-existing worktree change, record the exact command and error as a validation gap without changing that unrelated file.

- [ ] **Step 5: Remove the isolated mise installation and report evidence**

Run:

```bash
mise_test_root="$PWD/.cache/mise-integration"
test "$mise_test_root" = "$PWD/.cache/mise-integration"
test -x "$mise_test_root/mise"
rm -rf -- "$mise_test_root"
git status --short
```

Expected: only the temporary isolated mise installation is removed; repository state is unchanged. Report the committed files, exact tool versions, workflow migration evidence, gate results, and any unrelated validation gap.
