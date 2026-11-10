export async function onRequest(context) {
  const target = new URL(context.request.url);
  target.hostname = 'suitokensaver-snapshots.jeffier2015.workers.dev';
  return fetch(new Request(target, context.request));
}
