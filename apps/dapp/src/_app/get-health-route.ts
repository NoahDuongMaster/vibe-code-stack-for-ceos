import { NextResponse } from 'next/server';
import pkg from '../../package.json';

// Health check endpoint — IETF RFC 9457 (Problem Details) compatible.
// Response shape follows the draft Health Check Response Format for HTTP APIs.
export const getHealth = async () => {
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
