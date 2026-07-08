export interface NavLink {
  href: string;
  label: string;
}

/** Site-wide identity + SEO defaults, consumed by the shared Layout. */
export const SITE = {
  name: "AI-First Next.js Boilerplate",
  shortName: "AI-First",
  locale: "en_US",
  description:
    "AI-first monorepo boilerplate — type-safe, edge-ready, built for micro-frontends and microservices.",
  /** Absolute or root-relative path to the default social share image. */
  ogImage: "/favicon.svg",
} as const;

/** In-page anchor navigation shown in the header. */
export const NAV_LINKS: readonly NavLink[] = [
  { href: "#features", label: "Features" },
  { href: "#stack", label: "Stack" },
];

/** External / social destinations. */
export const SOCIAL_LINKS = {
  github: "https://github.com/NoahDuongMaster/vibe-code-stack-for-ceos",
} as const;
