const PALETTE = [
  '#7C3AED', '#2563EB', '#0891B2', '#059669', '#D97706',
  '#DC2626', '#DB2777', '#9333EA', '#0284C7', '#16A34A',
];

export function avatarColor(seed: string): string {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function initial(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (!parts[0]) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
