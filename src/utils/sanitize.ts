export function sanitizeUrl(url: unknown): string {
  if (typeof url !== 'string') {
    return '#';
  }
  const trimmed = url.trim();
  if (!trimmed) return '#';
  try {
    const base = typeof window !== 'undefined' ? window.location.origin : 'https://example.com';
    const parsed = new URL(trimmed, base);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return '#';
    }
    if (!trimmed.startsWith('http')) {
      return parsed.pathname + parsed.search + parsed.hash;
    }
    return parsed.toString();
  } catch {
    return '#';
  }
}
