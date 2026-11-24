// Only fields needed by the public renderer may leave the server. Source
// evidence, review data, prompts and internal metadata remain private.
type Data = Record<string, unknown>;
const object = (value: unknown): Data => value && typeof value === 'object' && !Array.isArray(value) ? value as Data : {};
const pick = (value: unknown, keys: string[]): Data => {
  const source = object(value);
  return Object.fromEntries(keys.filter(key => Object.prototype.hasOwnProperty.call(source, key) && (source[key] == null || ['string', 'number', 'boolean'].includes(typeof source[key]))).map(key => [key, source[key]]));
};
const items = (value: unknown, keys: string[]) => Array.isArray(value) ? value.slice(0, 100).map(item => pick(item, keys)) : [];

export function publicDemo(input: unknown): Data {
  const content = object(input);
  const clean = pick(content, ['businessName', 'category', 'city', 'styleLevel', 'disclaimer']);
  for (const section of ['hero', 'about', 'closing']) clean[section] = pick(content[section], ['eyebrow', 'title', 'description', 'body', 'cta']);
  for (const section of ['services', 'highlights', 'process', 'sections']) clean[section] = items(content[section], ['title', 'body']);
  clean.faq = items(content.faq, ['question', 'answer']);
  const showcase = object(content.showcase);
  clean.showcase = { ...pick(showcase, ['kind', 'title', 'sample']), items: items(showcase.items, ['title', 'subtitle', 'detail']) };
  clean.contact = pick(content.contact, ['email', 'phone', 'instagram']);
  clean.photos = items(content.photos, ['url', 'kind', 'alt', 'credit', 'link', 'source']);
  clean.theme = pick(content.theme, ['background', 'surface', 'accent', 'text', 'muted', 'style']);
  const design = pick(content.design, ['version', 'fonts', 'shape', 'hero', 'nav', 'services', 'highlights', 'closing', 'art', 'align', 'order', 'seed']);
  if (content.design && typeof content.design === 'object' && !Array.isArray(content.design)) design.colors = pick(object(content.design).colors, ['bg', 'surface', 'text', 'muted', 'accent', 'alt']);
  clean.design = design;
  return clean;
}
