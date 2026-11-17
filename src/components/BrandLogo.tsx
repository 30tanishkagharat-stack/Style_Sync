interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
  subtitle?: string;
}

const SIZE_MAP = {
  sm: {
    box: 'w-8 h-8 rounded-lg',
    svg: 'w-5 h-5',
    title: 'text-xl',
  },
  md: {
    box: 'w-10 h-10 rounded-xl',
    svg: 'w-6 h-6',
    title: 'text-2xl',
  },
  lg: {
    box: 'w-11 h-11 rounded-xl',
    svg: 'w-7 h-7',
    title: 'text-3xl',
  },
} as const;

export function BrandLogo({
  size = 'md',
  showWordmark = true,
  subtitle,
}: BrandLogoProps) {
  const dims = SIZE_MAP[size];

  return (
    <div className="inline-flex items-center gap-3 select-none">
      <span
        aria-hidden="true"
        className={`${dims.box} bg-[#F7F3ED] border border-[#E9DFD2] inline-flex items-center justify-center shrink-0`}
      >
        <svg viewBox="0 0 40 40" fill="none" className={dims.svg}>
          <path
            d="M20 14.2V11.5C20 9.4 21.7 8 23.5 8.7C24.7 9.2 25.1 10.5 24.3 11.6"
            className="text-[#292929]"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M13.6 25.6H9.4C7.9 25.6 7.3 23.8 8.5 22.9L20 14.2L31.5 22.9C32.7 23.8 32.1 25.6 30.6 25.6H26.4"
            className="text-[#292929]"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M20 21.4L21 24.5L24.1 25.6L21 26.7L20 29.8L19 26.7L15.9 25.6L19 24.5Z"
            className="text-[#B76545]"
            fill="currentColor"
          />
        </svg>
      </span>

      {showWordmark && (
        <div className="min-w-0">
          <span
            className={`${dims.title} font-semibold tracking-tight text-[#292929] font-serif leading-none block`}
          >
            Style<span className="text-[#B76545]">Sync</span>
          </span>
          {subtitle && (
            <span className="text-xs text-[#85817B] mt-1 block truncate">
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
