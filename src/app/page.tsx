import { ArrowRight, BookOpen, Layers, Zap } from 'lucide-react';
import Link from 'next/link';

const STACK = [
  'Next.js 15',
  'React 19',
  'TypeScript',
  'Tailwind CSS v4',
  'Ark UI',
  'TanStack Query',
  'Zustand',
  'Zod',
  'react-hook-form',
  'Vitest',
];

const FEATURES = [
  {
    icon: Zap,
    title: 'AI-First',
    description:
      'Every AI tool (Claude, Cursor, Copilot, DeepSeek, Gemini) reads the same rules and produces consistent code.',
  },
  {
    icon: Layers,
    title: 'Clean Architecture',
    description:
      'Strict layering: page → service → adapter. Components never call APIs directly.',
  },
  {
    icon: BookOpen,
    title: 'Canonical Examples',
    description:
      'src/__examples__/ contains working patterns for every common scenario — AI copies from these.',
  },
];

export default function WelcomePage() {
  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl w-full space-y-10 text-center">
        <div className="space-y-3">
          <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-mono font-semibold text-muted-foreground">
            v1.0.0
          </span>
          <h1 className="text-4xl font-bold tracking-tight">
            AI-First Next.js Boilerplate
          </h1>
          <p className="text-muted-foreground text-lg">
            Ship faster. Keep quality. Works with any AI tool.
          </p>
        </div>

        <hr className="border-border" />

        <div className="grid gap-4 text-left">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="flex gap-4 p-4 rounded-lg border bg-card"
            >
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
              <div>
                <p className="font-medium">{title}</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {description}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Stack
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            {STACK.map((tech) => (
              <span
                key={tech}
                className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-mono"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>

        <hr className="border-border" />

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="https://github.com/truongdn-it/nextjs-boilerplate"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            View on GitHub
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/api/health"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md border text-sm font-medium hover:bg-accent transition-colors"
          >
            API Health Check
          </Link>
        </div>
      </div>
    </main>
  );
}
