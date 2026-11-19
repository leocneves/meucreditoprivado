export function assetPath(ticker?: string | null): string {
  const clean = String(ticker || '').trim().toLowerCase();
  return clean ? `/asset/${encodeURIComponent(clean)}/` : '/';
}

export function slugify(text?: string | null): string {
  return String(text || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
