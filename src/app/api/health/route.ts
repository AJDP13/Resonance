import { NextResponse, type NextRequest } from 'next/server';
import { HealthCheckQuerySchema, invalidPayloadError } from '@/shared/protocol';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const queryObj = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = HealthCheckQuerySchema.safeParse(queryObj);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'Invalid query parameters';
    return NextResponse.json(invalidPayloadError(msg), { status: 400 });
  }
  return NextResponse.json({ status: 'ok' }, { status: 200 });
}
