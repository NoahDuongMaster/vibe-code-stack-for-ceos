---
name: Fresh Docs
description: Fetch up-to-date library documentation to avoid stale AI knowledge
trigger: /fresh-docs
---

# Fresh Docs — Live Documentation Lookup

Use this skill when you need current API documentation for any library in the stack.

## Why this exists

LLMs have a training knowledge cut-off. For fast-moving libraries (Next.js, TanStack Query, Zod v4, Ark UI),
the AI's built-in knowledge may be outdated. This skill uses the Context7 MCP to fetch current docs at query time.

**Scientific basis**: RAG (Lewis et al., NeurIPS 2020) — retrieval at inference time outperforms parametric
memory alone for knowledge-intensive tasks. Context7: 57.6k ⭐ GitHub, leading docs MCP (deep-research verified,
June 2026).

## Steps

1. **Identify the library** — call `context7:resolve_library_id` with the library name
   ```
   resolve_library_id("nextjs")
   resolve_library_id("tanstack-query")
   resolve_library_id("zod")
   ```

2. **Fetch relevant docs** — call `context7:get_library_docs` with the topic
   ```
   get_library_docs(libraryId="/vercel/next.js", topic="server actions", tokens=5000)
   get_library_docs(libraryId="/tanstack/query", topic="useMutation", tokens=3000)
   ```

3. **Fetch changelogs or release notes** — use the built-in `WebFetch` tool (no MCP needed)
   ```
   WebFetch("https://github.com/vercel/next.js/releases")
   WebFetch("https://zod.dev/changelog")
   ```

4. Answer the question grounded in the fetched content, citing the source.

## Common library IDs (pre-resolved)
| Library | Context7 ID |
|---------|-------------|
| Next.js | /vercel/next.js |
| TanStack Query | /tanstack/query |
| TanStack Table | /tanstack/table |
| Zod | /colinhacks/zod |
| Zustand | /pmndrs/zustand |
| Ark UI | /chakra-ui/ark |
| react-hook-form | /react-hook-form/react-hook-form |
| motion | /motiondivision/motion |
| iron-session | /vvo/iron-session |
| next-safe-action | /TheEdoRan/next-safe-action |
| nuqs | /47ng/nuqs |

## Token budget
- Use `tokens=3000` for targeted questions
- Use `tokens=8000` for migration guides or full API surfaces

## Note on security
Context7 is pinned to `@3.2.1` in `.mcp.json`. Do not use `@latest` — supply chain risk
(CVE-2026-33032, September 2025 malicious MCP incident). Update only after reviewing changelog.
