import type { NextRequest } from 'next/server'

async function relay(request: NextRequest) {
  const origin = request.headers.get('origin')
  const expectedOrigin = process.env.CASINO_PUBLIC_ORIGIN || request.nextUrl.origin
  if (request.method === 'POST' && origin && origin !== expectedOrigin) {
    return Response.json({ error: 'Use the casino’s own page.' }, { status: 403 })
  }
  const admin = request.nextUrl.searchParams.has('admin')
  const transfer = request.nextUrl.searchParams.get('transfer')
  if (admin && transfer !== null && !/^[a-f0-9]{64}$/.test(transfer)) {
    return Response.json({ error: 'Invalid transfer hash.' }, { status: 400 })
  }
  const path = admin ? (transfer ? '/admin/transfer/' + transfer : '/admin') : '/game'
  const backend = process.env.CASINO_BACKEND_URL || 'http://127.0.0.1:4010'
  const headers = new Headers()
  for (const key of ['cookie', 'content-type', 'authorization']) {
    const value = request.headers.get(key)
    if (value) headers.set(key, value)
  }
  try {
    const response = await fetch(new URL(path, backend), {
      method: request.method,
      headers,
      body: request.method === 'POST' ? await request.text() : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(30000),
    })
    const outgoing = new Headers({
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    })
    const cookie = response.headers.get('set-cookie')
    if (cookie) outgoing.set('Set-Cookie', cookie)
    return new Response(response.body, { status: response.status, headers: outgoing })
  } catch {
    return Response.json({ error: 'Casino backend is unavailable.' }, { status: 502 })
  }
}
export const GET = relay
export const POST = relay
