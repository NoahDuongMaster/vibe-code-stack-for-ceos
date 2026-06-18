import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const GET = async (request: NextRequest) => {
  const searchParams = request.nextUrl.searchParams;
  const delay = searchParams.get('delay');
  const error = searchParams.get('error');
  await new Promise((resolve) => setTimeout(resolve, delay ? +delay : 0));
  if (error) {
    return NextResponse.json(
      { statusCode: 500, message: 'Internal Server Error!' },
      { status: 500 },
    );
  }
  return NextResponse.json({ data: `Data!` });
};

export { GET };
