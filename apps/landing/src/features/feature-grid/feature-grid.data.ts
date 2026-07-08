export interface Feature {
  icon: string;
  title: string;
  body: string;
}

export const FEATURES = [
  {
    icon: '🧩',
    title: 'Micro-frontends',
    body: 'Next.js app + Astro landing as independent workspaces, shipped from one repo.',
  },
  {
    icon: '🔌',
    title: 'Connect RPC',
    body: 'Protobuf contract, gRPC-compatible — the server’s types flow straight into the frontend.',
  },
  {
    icon: '⚡',
    title: 'Edge-native',
    body: 'Cloudflare Workers + Vite for the app and services; static assets for the landing.',
  },
  {
    icon: '🧱',
    title: 'Turborepo',
    body: 'Cached build / typecheck / lint pipeline across apps, services, and shared packages.',
  },
  {
    icon: '🛡️',
    title: 'Type-safe contracts',
    body: 'Zod schemas in one package, shared by frontend and backend — zero drift.',
  },
  {
    icon: '🎨',
    title: 'Panda CSS + Ark UI',
    body: 'Accessible, themeable design system in the app; fast static styling here.',
  },
] as const satisfies readonly Feature[];
