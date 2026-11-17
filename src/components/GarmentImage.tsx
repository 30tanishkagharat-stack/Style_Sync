import { Shirt } from 'lucide-react';
import { useState } from 'react';

interface GarmentImageProps {
  src?: string | null;
  alt: string;
  className?: string;
}

export function GarmentImage({ src, alt, className = '' }: GarmentImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-[#E9DFD2]/55 text-[#85817B] p-4 text-center ${className}`}
        aria-label={alt}
      >
        <Shirt className="w-7 h-7 mb-2 stroke-[1.5]" />
        <span className="text-xs font-medium text-[#292929]/75 line-clamp-2">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`object-cover w-full h-full bg-[#E9DFD2]/30 ${className}`}
    />
  );
}
