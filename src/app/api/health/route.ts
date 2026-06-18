import { NextResponse } from 'next/server';

export const runtime = 'edge';

// Health check endpoint — IETF RFC 9457 (Problem Details) compatible.
// Response shape follows the draft Health Check Response Format for HTTP APIs
// (draft-inadarei-api-health-check).
const GET = async () => {
  return NextResponse.json(
    {
      status: 'pass',
      version: process.env.npm_package_version ?? '1.0.0',
      releaseId: process.env.NEXT_PUBLIC_APP_VERSION ?? '1.0.0',
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
