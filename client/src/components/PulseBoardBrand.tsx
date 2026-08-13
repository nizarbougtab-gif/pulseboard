type PulseBoardBrandProps = {
  compact?: boolean;
  className?: string;
};

export function PulseBoardMark({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`relative inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-900 text-white shadow-sm shadow-emerald-900/25 ring-1 ring-white/20 ${className}`}
    >
      <svg viewBox="0 0 36 36" className="h-full w-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10.5 27V9.3h8.2c5.3 0 8.8 2.8 8.8 7.3s-3.5 7.2-8.8 7.2h-3" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6 19h5.1l2.1-4.6 3.2 9.2 2.3-5.2H30" stroke="#FCD34D" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export default function PulseBoardBrand({ compact = false, className = "" }: PulseBoardBrandProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`} aria-label="PulseBoard">
      <PulseBoardMark />
      {!compact && (
        <span className="leading-none">
          <span className="block text-base font-bold tracking-tight text-foreground">PulseBoard</span>
          <span className="mt-1 block text-[9px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Soins en équipe</span>
        </span>
      )}
    </span>
  );
}
