import { NextRequest, NextResponse } from 'next/server';

function getUserFromHeaders(request: NextRequest) {
  return {
    uid: request.headers.get('x-user-uid') || '',
    role: request.headers.get('x-user-role') || '',
    tenantId: request.headers.get('x-user-tenant') || 'angsana',
  };
}

function isInternal(role: string): boolean {
  return role === 'internal-admin' || role === 'internal-user';
}

/**
 * POST /api/clients/[clientId]/prospecting-profile/ai-review
 * Trigger AI review. Returns 501 Not Implemented. Internal users only.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  // Consume params to avoid Next.js warning
  await params;
  const user = getUserFromHeaders(request);

  if (!isInternal(user.role)) {
    return NextResponse.json({ error: 'Forbidden: only internal users can trigger AI review' }, { status: 403 });
  }

  return NextResponse.json(
    {
      error: 'AI review integration pending. This will analyse the client\'s website, AI source documents, and CPP data to generate suggestions.',
      status: 'not-implemented',
    },
    { status: 501 }
  );
}
