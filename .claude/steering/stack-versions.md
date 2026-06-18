---
inclusion: always
---

# Current Stack Versions (Knowledge Grounding)

> AI: When answering questions about any library below, use Context7 (`resolve_library_id` + `get_library_docs`) to
> fetch the CURRENT documentation for that exact version. Never rely solely on training data for API specifics.

## Core Framework
| Package | Version | Docs |
|---------|---------|------|
| next | ^15.3 | https://nextjs.org/docs |
| react | ^19.0 | https://react.dev |
| typescript | ^5.8 | https://www.typescriptlang.org/docs |

## Styling
| Package | Version | Docs |
|---------|---------|------|
| tailwindcss | ^4.1 | https://tailwindcss.com/docs |
| @ark-ui/react | ^5.x | https://ark-ui.com/react/docs |

## Data & State
| Package | Version | Docs |
|---------|---------|------|
| @tanstack/react-query | ^5.80 | https://tanstack.com/query/latest/docs |
| @tanstack/react-table | ^8.21 | https://tanstack.com/table/latest/docs |
| zustand | ^5.0 | https://zustand.docs.pmnd.rs |
| nuqs | ^2.4 | https://nuqs.47ng.com |

## Forms & Validation
| Package | Version | Docs |
|---------|---------|------|
| react-hook-form | ^7.x | https://react-hook-form.com |
| zod | ^4.0 | https://zod.dev |
| @hookform/resolvers | ^5.x | — |

## Server
| Package | Version | Docs |
|---------|---------|------|
| iron-session | ^8.0 | https://github.com/vvo/iron-session |
| next-safe-action | ^7.9 | https://next-safe-action.dev |
| ofetch | ^1.4 | https://github.com/unjs/ofetch |

## Animation & Analytics
| Package | Version | Docs |
|---------|---------|------|
| motion | ^12 | https://motion.dev/docs |
| @vercel/analytics | ^1 | https://vercel.com/docs/analytics |

## Dev Tooling
| Package | Version | Notes |
|---------|---------|-------|
| biome | ^2.x | Format + lint (replaces prettier + stylelint) |
| vitest | ^3.2 | Testing |
| @testing-library/react | ^16.x | Component testing |

## How to get fresh docs (for AI)

When the AI needs current API info, use these MCP tools in order:
1. `context7:resolve_library_id` — find the library ID (e.g. "nextjs", "tanstack-query")
2. `context7:get_library_docs` — fetch current docs for that library/topic
3. `fetch:fetch` — fetch a specific URL (changelog, release notes, blog post)

**Example**: "What's the correct Next.js 15 API for dynamic params?"
→ `resolve_library_id("nextjs")` → `get_library_docs(id, topic="dynamic routes")`
