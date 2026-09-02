import { cn } from '@/lib/utils';

/** Up to two initials — first and last word, so "Priya Raman" reads PR. */
function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = words[0]?.[0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

/**
 * Deterministic hue from the name, so the same person always gets the same
 * colour and a list reads as distinct faces rather than a wall of grey.
 * Only the hue is chosen here — lightness and chroma live in CSS
 * (`.contact-avatar`) so the swatch re-balances for light and dark themes.
 */
const HUES = [254, 200, 158, 82, 32, 6, 300, 224];

function hueFor(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return HUES[hash % HUES.length] ?? 254;
}

export function ContactAvatar({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'contact-avatar inline-flex size-10 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold',
        className,
      )}
      style={{ '--avatar-hue': hueFor(name) } as React.CSSProperties}
    >
      {initialsOf(name)}
    </span>
  );
}
