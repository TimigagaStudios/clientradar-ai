export async function inspectPublicWebsite(url: string | undefined) {
  if (!url) return null;
  let parsed: URL;
  try { parsed = new URL(url.startsWith('http') ? url : `https://${url}`); } catch { return null; }
  if (!['http:', 'https:'].includes(parsed.protocol)) return null;
  try {
    const response = await fetch(parsed.toString(), { signal: AbortSignal.timeout(5000), headers: { 'User-Agent': 'ClientRadar-DemoFactory/1.0' } });
    if (!response.ok) return null;
    const html = (await response.text()).slice(0, 250_000);
    const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() || null;
    const description = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i)?.[1]?.trim() || null;
    const colors = [...new Set((html.match(/#[0-9a-fA-F]{6}/g) || []).map((color) => color.toLowerCase()))].slice(0, 8);
    return { url: parsed.toString(), title, description, colors };
  } catch {
    return null;
  }
}
