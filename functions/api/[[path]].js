export async function onRequest(context) {
  const target = new URL(context.request.url);
  if (!['/api/scan', '/api/resolve'].includes(target.pathname) && !target.pathname.startsWith('/api/snapshots/')) {
    return new Response('Not found', { status: 404 });
  }
  const origin = context.request.headers.get('origin');
  if (origin && origin !== target.origin) return new Response('Cross-origin requests are not allowed.', { status: 403 });
  target.hostname = 'suitokensaver-snapshots.jeffier2015.workers.dev';
  const request = new Request(target, context.request);
  request.headers.delete('origin');
  return fetch(request);
}
