import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const MAX_DELAY_MS = 5_000;

// Dev-only demo endpoint for exercising loading/error states — never useful
// (and a cheap request-holding DoS vector via an unbounded `delay`) in
// production, so it doesn't exist there at all.
const GET = async (request: NextRequest) => {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

  const searchParams = request.nextUrl.searchParams;
  const requestedDelay = Number(searchParams.get('delay'));
  const delay = Number.isFinite(requestedDelay)
    ? Math.min(Math.max(requestedDelay, 0), MAX_DELAY_MS)
    : 0;
  const error = searchParams.get('error');
  await new Promise((resolve) => setTimeout(resolve, delay));
  if (error) {
    return NextResponse.json(
      { statusCode: 500, message: 'Internal Server Error!' },
      { status: 500 },
    );
  }
  return NextResponse.json({ data: `Data!` });
};

export { GET };
