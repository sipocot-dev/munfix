/** MunFix mark: a map pin with a check, on ink navy. Decorative; the brand name is always next to it. */
export default function Logo({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 36" className={className} aria-hidden focusable="false">
      <rect width="36" height="36" rx="8" fill="#1d3557" />
      <path d="M18 29s-8-7.1-8-12.6a8 8 0 0 1 16 0C26 21.9 18 29 18 29Z" fill="#fff" />
      <path d="m14.6 16.5 2.4 2.4 4.6-4.8" fill="none" stroke="#c2410c" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
