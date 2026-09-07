import React, { useEffect, useState } from 'react';
import { getLocalFlagUrl, getIso2 } from '@/lib/flags';

interface FlagImageProps {
  code: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function FlagImage({ code, size = 64, className = '', style }: FlagImageProps) {
  const [failed, setFailed] = useState(false);
  const url = getLocalFlagUrl(code || '');
  useEffect(() => setFailed(false), [url]);
  const iso2 = getIso2(code || '');
  if (url && !failed) {
    return (
      <img
        src={url}
        alt={code}
        width={size}
        height={Math.round(size * 0.66)}
        className={`inline-block object-cover rounded-sm shadow-md ${className}`}
        style={{ width: size, height: Math.round(size * 0.66), imageRendering: 'auto', ...style }}
        onError={() => setFailed(true)}
      />
    );
  }
  if (!iso2) return null;
  // Bundled flag-icons fallback: every ISO flag is local after npm install.
  return (
    <span
      aria-label={code}
      className={`fi fi-${iso2.toLowerCase()} inline-block shrink-0 rounded-sm shadow-md ${className}`}
      style={{ width: size, height: Math.round(size * 0.66), display: 'inline-block', ...style }}
    />
  );
}
