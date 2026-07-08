import { NextResponse } from 'next/server';
import pkg from '../../../../package.json';

export const runtime = 'edge';

// Health check endpoint — IETF RFC 9457 (Problem Details) compatible.
// Response shape follows the draft Health Check Response Format for HTTP APIs
// (draft-inadarei-api-health-check).
//
// Version comes from a bundler-resolved JSON import (inlined at build time),
// not `process.env.npm_package_version` — the latter is only set by
// npm/pnpm's own script-runner env and is never populated at runtime in the
// Cloudflare Workers deploy target.
const GET = async () => {
  return NextResponse.json(
    {
      status: 'pass',
      version: pkg.version,
      releaseId: pkg.version,
      time: new Date().toISOString(),
    },
    {
      headers: {
        'Content-Type': 'application/health+json',
        'Cache-Control': 'no-store',
      },
    },
  );
};

export { GET };
