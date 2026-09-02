import { cn } from '@/lib/utils';

/**
 * The logo mark: a gradient tile with a small network glyph — three nodes and
 * the links between them, which is what the app is actually about.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'bg-brand-gradient ring-brand/20 inline-flex shrink-0 items-center justify-center rounded-xl shadow-sm ring-1',
        'size-9',
        className,
      )}
    >
      <svg viewBox="0 0 24 24" fill="none" className="size-5 text-white">
        <path
          d="M7 7.8 12 5l5 2.8M7 7.8v8.4L12 19l5-2.8V7.8M7 7.8 12 10.6l5-2.8M12 10.6V19"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.55"
        />
        <circle cx="12" cy="5" r="2.15" fill="currentColor" />
        <circle cx="7" cy="16.2" r="2.15" fill="currentColor" />
        <circle cx="17" cy="16.2" r="2.15" fill="currentColor" />
      </svg>
    </span>
  );
}

export function BrandWordmark({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <BrandMark />
      <span className="leading-tight">
        <span className="block text-[15px] font-semibold tracking-tight">
          Networking Tracker
        </span>
        <span className="text-muted-foreground block text-[11px] tracking-wide uppercase">
          Berkeley
        </span>
      </span>
    </span>
  );
}
