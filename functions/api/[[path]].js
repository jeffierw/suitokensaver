export async function onRequest(context) {
  return context.env.SNAPSHOT_API.fetch(context.request);
}
