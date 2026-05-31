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
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label="Cel logo"
      className={className}
      data-testid="img-logo"
    >
      {/* Outer onion-skin layer - opacity 0.3 */}
      <path
        d="M22 6 C28 6 28 26 22 26"
        strokeOpacity="0.3"
        strokeWidth="1.5"
      />
      {/* Middle onion-skin layer - opacity 0.5 */}
      <path
        d="M20 8 C24 8 24 24 20 24"
        strokeOpacity="0.5"
        strokeWidth="1.5"
      />
      {/* Inner onion-skin layer - opacity 0.7 */}
      <path
        d="M18 10 C22 10 22 22 18 22"
        strokeOpacity="0.7"
        strokeWidth="1.5"
      />
      {/* Main "C" shape - full opacity */}
      <path
        d="M16 12 C19 12 19 20 16 20"
        strokeWidth="2"
      />
      {/* Film sprocket perforation squares on left edge */}
      <rect x="6" y="8" width="3" height="3" rx="0.75" fill="currentColor" stroke="none" opacity="0.9" />
      <rect x="6" y="14.5" width="3" height="3" rx="0.75" fill="currentColor" stroke="none" opacity="0.9" />
      <rect x="6" y="21" width="3" height="3" rx="0.75" fill="currentColor" stroke="none" opacity="0.9" />
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
