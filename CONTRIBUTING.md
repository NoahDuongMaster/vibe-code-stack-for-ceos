# Contributing to [Vibe Code Stack For CEOs](https://github.com/NoahDuongMaster/vibe-code-stack-for-ceos)

Thank you for your interest in contributing! We welcome contributions from the community to make this monorepo better.

Before you start contributing, please take a moment to read the following guidelines.

## Code of Conduct

This project and everyone participating in it are governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to hi@duongnamtruong.com.

## How Can I Contribute?

### Reporting Bugs

If you find a bug, please open an issue on our [issue tracker](https://github.com/NoahDuongMaster/vibe-code-stack-for-ceos/issues). Include detailed information about how to reproduce the bug, and what happened.

### Suggesting Enhancements

If you have ideas on how to improve the project or new features you would like to see, feel free to open an issue labeled as an enhancement.

### Pull Requests

We welcome your pull requests! Before submitting a pull request, please make sure to:

1. Fork the repository and create a branch following the naming convention below.
2. Follow the architecture rules in [`CLAUDE.md`](CLAUDE.md) — it's the single source of truth for folder structure, dependency direction, and naming.
3. Write commit messages following the convention below.
4. Run `mise run verify` for any workspace you touched.
5. Update `CLAUDE.md` or the relevant `README.md` if your change affects documented behavior.

### Development Setup

Install and activate [mise](https://mise.jdx.dev/installing-mise.html), then run:

```bash
mise install
mise run install
mise run dev            # starts every app in the monorepo (Turborepo)
```

See the root [`README.md`](README.md) for per-app mise tasks and the [Docker environments](README.md) section for containerized setup. Direct pnpm commands remain supported, and `.nvmrc` remains available for nvm users.

### Commit & Branch Conventions

```
type(scope): issue-123 short description   # commit
type(scope)/issue-123-short-description    # branch
```

Types: `feat|fix|hotfix|docs|style|refactor|perf|test|build|ci|chore|BREAKING_CHANGE`. Scopes: `dapp|admin|infra|backend|admin-backend|proxy|snapshot|tma|serverless`. Use `no-issue` in place of the issue number for trivial changes. See [`CLAUDE.md`](CLAUDE.md#git-conventions) for the full spec.

## Coding Standards

All coding standards — tech stack, folder structure, naming conventions, error handling, security, and testing rules — live in [`CLAUDE.md`](CLAUDE.md). Read it before opening a PR.

## License

By contributing to this project, you agree that your contributions will be licensed under the project's [license](https://github.com/NoahDuongMaster/vibe-code-stack-for-ceos/blob/main/LICENSE).

## Contact

If you have questions or need further assistance, feel free to contact us at hi@duongnamtruong.com.

Thank you for contributing to NextJS Boilerplate!
