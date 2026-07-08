import {
  ArrowRight,
  BookOpen,
  Code2,
  Layers,
  Shield,
  Terminal,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { css } from '@/styled-system/css';
import { flex, grid } from '@/styled-system/patterns';

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.694.825.576C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

const FEATURES = [
  {
    icon: Zap,
    title: 'AI-First Development',
    description:
      'One CLAUDE.md rule file at the repo root. Every AI coding assistant reads the same architecture rules — consistent, compliant code by construction.',
  },
  {
    icon: Layers,
    title: 'Vertical Slice Architecture',
    description:
      'Strict dependency direction: page → service → adapter. Features are isolated, testable, and easy to reason about.',
  },
  {
    icon: BookOpen,
    title: 'Documented Code Patterns',
    description:
      'Canonical schema/adapter/service/barrel patterns defined in CLAUDE.md. AI assistants and contributors follow the same reference examples.',
  },
  {
    icon: Shield,
    title: 'Production Security',
    description:
      'CSP headers, input validation with Zod, server-only guards, rate-limited login, and zero secrets in client bundles.',
  },
  {
    icon: Terminal,
    title: 'Developer Experience',
    description:
      'Biome + ESLint, Vitest + Playwright, Husky hooks, and type-safe everything — from env vars to API routes.',
  },
  {
    icon: Code2,
    title: 'Modern Stack',
    description:
      'Next.js 16, React 19, TypeScript 6, Panda CSS, Ark UI, TanStack Query, Zustand, and more — all pre-configured.',
  },
];

const STACK_GROUPS = [
  {
    label: 'Core',
    items: ['Next.js 16', 'React 19', 'TypeScript 6'],
  },
  {
    label: 'Styling',
    items: ['Panda CSS', 'Ark UI'],
  },
  {
    label: 'State',
    items: ['TanStack Query', 'Zustand', 'nuqs'],
  },
  {
    label: 'Forms & Validation',
    items: ['react-hook-form', 'Zod', 'next-safe-action'],
  },
  {
    label: 'Testing',
    items: ['Vitest', 'Playwright'],
  },
];

export default function HomePage() {
  return (
    <main>
      {/* Hero */}
      <section
        className={flex({
          direction: 'column',
          align: 'center',
          justify: 'center',
          minH: '100vh',
          px: '6',
          py: '24',
          position: 'relative',
          overflow: 'hidden',
        })}
      >
        <div
          className={css({
            position: 'absolute',
            inset: 0,
            bgGradient: 'to-b',
            gradientFrom: 'background',
            gradientVia: 'background',
            gradientTo: 'secondary',
            opacity: 0.6,
            zIndex: 0,
          })}
        />

        <div
          className={flex({
            direction: 'column',
            align: 'center',
            gap: '8',
            maxW: '3xl',
            w: 'full',
            textAlign: 'center',
            position: 'relative',
            zIndex: 1,
          })}
        >
          <span
            className={css({
              display: 'inline-flex',
              alignItems: 'center',
              gap: '2',
              rounded: 'full',
              borderWidth: '1px',
              borderColor: 'border',
              bg: 'card',
              px: '4',
              py: '1.5',
              fontSize: 'sm',
              color: 'muted.foreground',
            })}
          >
            <span
              className={css({
                w: '2',
                h: '2',
                rounded: 'full',
                bg: 'oklch(0.7 0.15 160)',
              })}
            />
            Open Source &middot; MIT Licensed
          </span>

          <h1
            className={css({
              fontSize: { base: '4xl', md: '6xl', lg: '7xl' },
              fontWeight: 'bold',
              letterSpacing: 'tight',
              lineHeight: '1.1',
            })}
          >
            Build with AI.
            <br />
            <span className={css({ color: 'muted.foreground' })}>
              Ship with confidence.
            </span>
          </h1>

          <p
            className={css({
              fontSize: { base: 'lg', md: 'xl' },
              color: 'muted.foreground',
              maxW: '2xl',
              lineHeight: '1.7',
            })}
          >
            A production-ready Next.js boilerplate where every AI assistant
            speaks the same language. Clean architecture, strict conventions,
            and canonical examples — so you and your AI tools ship faster
            without sacrificing quality.
          </p>

          <div
            className={flex({
              direction: { base: 'column', sm: 'row' },
              gap: '3',
              mt: '2',
            })}
          >
            <Link
              href="https://github.com/NoahDuongMaster/ai-first-nextjs-boilerplate"
              target="_blank"
              rel="noopener noreferrer"
              className={flex({
                align: 'center',
                gap: '2',
                px: '6',
                py: '3',
                rounded: 'lg',
                bg: 'primary',
                color: 'primary.foreground',
                fontSize: 'sm',
                fontWeight: 'semibold',
                cursor: 'pointer',
                transition: 'all',
                transitionDuration: '200ms',
                _hover: { opacity: 0.9, transform: 'translateY(-1px)' },
              })}
            >
              <GitHubIcon className={css({ h: '4', w: '4' })} />
              Get Started
              <ArrowRight className={css({ h: '4', w: '4' })} />
            </Link>
            <Link
              href="/api/health"
              className={flex({
                align: 'center',
                gap: '2',
                px: '6',
                py: '3',
                rounded: 'lg',
                borderWidth: '1px',
                borderColor: 'border',
                fontSize: 'sm',
                fontWeight: 'semibold',
                cursor: 'pointer',
                transition: 'all',
                transitionDuration: '200ms',
                _hover: { bg: 'accent', transform: 'translateY(-1px)' },
              })}
            >
              API Health Check
            </Link>
          </div>

          <div
            className={css({
              mt: '8',
              p: '4',
              rounded: 'xl',
              borderWidth: '1px',
              borderColor: 'border',
              bg: 'card',
              w: 'full',
              maxW: 'lg',
              fontFamily: 'mono',
              fontSize: 'sm',
              textAlign: 'left',
            })}
          >
            <div className={flex({ align: 'center', gap: '2', mb: '3' })}>
              <span
                className={css({
                  w: '3',
                  h: '3',
                  rounded: 'full',
                  bg: 'oklch(0.65 0.2 25)',
                })}
              />
              <span
                className={css({
                  w: '3',
                  h: '3',
                  rounded: 'full',
                  bg: 'oklch(0.8 0.15 85)',
                })}
              />
              <span
                className={css({
                  w: '3',
                  h: '3',
                  rounded: 'full',
                  bg: 'oklch(0.7 0.15 160)',
                })}
              />
            </div>
            <code className={css({ color: 'muted.foreground' })}>
              <span className={css({ color: 'foreground', opacity: 0.5 })}>
                $
              </span>{' '}
              npx create-next-app -e
              https://github.com/NoahDuongMaster/ai-first-nextjs-boilerplate
            </code>
          </div>
        </div>
      </section>

      {/* Features */}
      <section
        className={css({
          px: '6',
          py: { base: '16', md: '24' },
          maxW: '6xl',
          mx: 'auto',
        })}
      >
        <div
          className={flex({
            direction: 'column',
            align: 'center',
            gap: '4',
            mb: '16',
            textAlign: 'center',
          })}
        >
          <h2
            className={css({
              fontSize: { base: '3xl', md: '4xl' },
              fontWeight: 'bold',
              letterSpacing: 'tight',
            })}
          >
            Everything you need to ship
          </h2>
          <p
            className={css({
              color: 'muted.foreground',
              fontSize: 'lg',
              maxW: 'xl',
            })}
          >
            Batteries included. No configuration rabbit holes. Just clone, code,
            and deploy.
          </p>
        </div>

        <div
          className={grid({
            columns: { base: 1, md: 2, lg: 3 },
            gap: '6',
          })}
        >
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className={css({
                p: '6',
                rounded: 'xl',
                borderWidth: '1px',
                borderColor: 'border',
                bg: 'card',
                transition: 'all',
                transitionDuration: '200ms',
                _hover: {
                  borderColor: 'muted.foreground',
                  transform: 'translateY(-2px)',
                },
              })}
            >
              <div
                className={flex({
                  align: 'center',
                  justify: 'center',
                  w: '10',
                  h: '10',
                  rounded: 'lg',
                  bg: 'secondary',
                  mb: '4',
                })}
              >
                <Icon
                  className={css({
                    h: '5',
                    w: '5',
                    color: 'foreground',
                  })}
                />
              </div>
              <h3
                className={css({
                  fontWeight: 'semibold',
                  fontSize: 'lg',
                  mb: '2',
                })}
              >
                {title}
              </h3>
              <p
                className={css({
                  fontSize: 'sm',
                  color: 'muted.foreground',
                  lineHeight: '1.7',
                })}
              >
                {description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Stack */}
      <section
        className={css({
          px: '6',
          py: { base: '16', md: '24' },
          bg: 'secondary',
        })}
      >
        <div className={css({ maxW: '4xl', mx: 'auto' })}>
          <div
            className={flex({
              direction: 'column',
              align: 'center',
              gap: '4',
              mb: '12',
              textAlign: 'center',
            })}
          >
            <h2
              className={css({
                fontSize: { base: '3xl', md: '4xl' },
                fontWeight: 'bold',
                letterSpacing: 'tight',
              })}
            >
              The Stack
            </h2>
            <p
              className={css({
                color: 'muted.foreground',
                fontSize: 'lg',
              })}
            >
              Modern, maintained, and battle-tested.
            </p>
          </div>

          <div className={flex({ direction: 'column', gap: '6' })}>
            {STACK_GROUPS.map(({ label, items }) => (
              <div
                key={label}
                className={flex({
                  direction: { base: 'column', sm: 'row' },
                  align: { sm: 'center' },
                  gap: { base: '2', sm: '4' },
                })}
              >
                <span
                  className={css({
                    fontSize: 'xs',
                    fontWeight: 'semibold',
                    textTransform: 'uppercase',
                    letterSpacing: 'wider',
                    color: 'muted.foreground',
                    minW: '36',
                    flexShrink: 0,
                  })}
                >
                  {label}
                </span>
                <div className={flex({ wrap: 'wrap', gap: '2' })}>
                  {items.map((tech) => (
                    <span
                      key={tech}
                      className={css({
                        display: 'inline-flex',
                        alignItems: 'center',
                        rounded: 'md',
                        borderWidth: '1px',
                        borderColor: 'border',
                        bg: 'background',
                        px: '3',
                        py: '1.5',
                        fontSize: 'sm',
                        fontFamily: 'mono',
                        fontWeight: 'medium',
                        transition: 'colors',
                        _hover: { borderColor: 'muted.foreground' },
                      })}
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section
        className={css({
          px: '6',
          py: { base: '16', md: '24' },
        })}
      >
        <div
          className={flex({
            direction: 'column',
            align: 'center',
            gap: '6',
            maxW: '2xl',
            mx: 'auto',
            textAlign: 'center',
          })}
        >
          <h2
            className={css({
              fontSize: { base: '3xl', md: '4xl' },
              fontWeight: 'bold',
              letterSpacing: 'tight',
            })}
          >
            Ready to build?
          </h2>
          <p
            className={css({
              color: 'muted.foreground',
              fontSize: 'lg',
              lineHeight: '1.7',
            })}
          >
            Clone the repo, point your AI tool at it, and start shipping. The
            architecture guides both you and the AI to write clean, consistent
            code.
          </p>
          <Link
            href="https://github.com/NoahDuongMaster/ai-first-nextjs-boilerplate"
            target="_blank"
            rel="noopener noreferrer"
            className={flex({
              align: 'center',
              gap: '2',
              px: '8',
              py: '3',
              rounded: 'lg',
              bg: 'primary',
              color: 'primary.foreground',
              fontSize: 'sm',
              fontWeight: 'semibold',
              cursor: 'pointer',
              transition: 'all',
              transitionDuration: '200ms',
              _hover: { opacity: 0.9, transform: 'translateY(-1px)' },
            })}
          >
            <GitHubIcon className={css({ h: '4', w: '4' })} />
            View on GitHub
            <ArrowRight className={css({ h: '4', w: '4' })} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer
        className={css({
          px: '6',
          py: '8',
          borderTopWidth: '1px',
          borderColor: 'border',
        })}
      >
        <div
          className={flex({
            direction: { base: 'column', sm: 'row' },
            align: 'center',
            justify: 'space-between',
            gap: '4',
            maxW: '6xl',
            mx: 'auto',
          })}
        >
          <p className={css({ fontSize: 'sm', color: 'muted.foreground' })}>
            Built by{' '}
            <Link
              href="https://duongnamtruong.com"
              target="_blank"
              rel="noopener noreferrer"
              className={css({
                color: 'foreground',
                fontWeight: 'medium',
                _hover: { textDecoration: 'underline' },
              })}
            >
              Noah Duong
            </Link>
          </p>
          <p
            className={css({
              fontSize: 'sm',
              color: 'muted.foreground',
              fontFamily: 'mono',
            })}
          >
            MIT License
          </p>
        </div>
      </footer>
    </main>
  );
}
