/** Shared JSON response. Preserve application/no-cache policy for all API endpoints. */
export function json(data: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(data), { status, headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store', ...headers
  } });
}
