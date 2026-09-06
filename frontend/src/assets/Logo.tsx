// NIRAMAYA AI Logo — Geometric N mark
// SVG inline component

interface LogoProps {
  size?: number;
  variant?: 'mark' | 'full' | 'sidebar';
  className?: string;
}

export function NiramayaLogo({ size = 40, variant = 'mark', className = '' }: LogoProps) {
  const mark = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="NIRAMAYA AI Logo"
      className={className}
    >
      <rect width="40" height="40" rx="8" fill="#2563EB" />
      {/* Geometric N formed by connected nodes */}
      {/* Left vertical line */}
      <line x1="10" y1="10" x2="10" y2="30" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      {/* Right vertical line */}
      <line x1="30" y1="10" x2="30" y2="30" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      {/* Diagonal line */}
      <line x1="10" y1="10" x2="30" y2="30" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      {/* Nodes */}
      <circle cx="10" cy="10" r="2.5" fill="#14B8A6" />
      <circle cx="10" cy="30" r="2.5" fill="white" />
      <circle cx="30" cy="10" r="2.5" fill="white" />
      <circle cx="30" cy="30" r="2.5" fill="#14B8A6" />
      {/* Mid node on diagonal */}
      <circle cx="20" cy="20" r="2" fill="white" opacity="0.6" />
    </svg>
  );

  if (variant === 'mark') return mark;

  if (variant === 'sidebar') {
    return (
      <div className={`flex items-center gap-2.5 ${className}`}>
        {mark}
        <div>
          <div className="text-white font-bold text-sm tracking-wider leading-none">NIRAMAYA</div>
          <div className="text-blue-300 text-[10px] tracking-widest leading-none mt-0.5">AI</div>
        </div>
      </div>
    );
  }

  // Full variant — for login page
  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      {mark}
      <div className="text-center">
        <div className="text-white font-bold text-2xl tracking-widest">NIRAMAYA AI</div>
        <div className="text-blue-300 text-xs tracking-widest mt-1">INTELLIGENCE FOR A HEALTHIER NATION</div>
      </div>
    </div>
  );
}
