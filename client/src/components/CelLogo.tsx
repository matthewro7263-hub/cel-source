interface CelLogoProps {
  size?: number;
  className?: string;
}

export function CelLogo({ size = 24, className = "" }: CelLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label="Cel logo"
      className={className}
      data-testid="img-logo"
    >
      {/* filmstrip frame */}
      <rect x="4.5" y="6.5" width="23" height="19" rx="2.5" />
      {/* sprocket dots top */}
      <circle cx="9" cy="10" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="16" cy="10" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="23" cy="10" r="0.9" fill="currentColor" stroke="none" />
      {/* sprocket dots bottom */}
      <circle cx="9" cy="22" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="16" cy="22" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="23" cy="22" r="0.9" fill="currentColor" stroke="none" />
      {/* play triangle in middle frame */}
      <path d="M14.5 13.5 L20 16 L14.5 18.5 Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function CelWordmark({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`} data-testid="wordmark-cel">
      <span className="text-primary"><CelLogo size={22} /></span>
      <span className="font-display text-lg font-bold tracking-tight">Cel</span>
    </div>
  );
}
