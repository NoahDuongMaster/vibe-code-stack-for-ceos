'use client';

import Image from 'next/image';
import { useState } from 'react';
import { css, cx } from '@/styled-system/css';

type TMarketLogoProps = {
  className?: string;
  imageUrl?: string;
  name: string;
  size: 24 | 28 | 32 | 40;
  symbol: string;
};

const logoFrameStyle = css({
  display: 'grid',
  placeItems: 'center',
  flexShrink: 0,
  overflow: 'hidden',
  color: 'bone',
  bgColor: 'void',
  borderWidth: '1px',
  borderColor: 'bone/18',
  borderRadius: 'full',
  boxShadow: 'inset 0 0 16px rgba(233, 241, 226, 0.08)',
});

const fallbackStyle = css({
  fontFamily: 'var(--font-mono), ui-monospace, monospace',
  fontSize: '2xs',
  fontWeight: '600',
  letterSpacing: '-0.04em',
});

export function MarketLogo({
  className,
  imageUrl,
  name,
  size,
  symbol,
}: TMarketLogoProps) {
  const [failedImageUrl, setFailedImageUrl] = useState<string>();
  const showImage = Boolean(imageUrl && failedImageUrl !== imageUrl);

  return (
    <span
      aria-hidden="true"
      className={cx(logoFrameStyle, className)}
      style={{ width: size, height: size }}
      title={name}
    >
      {showImage ? (
        <Image
          alt=""
          height={size}
          onError={() => setFailedImageUrl(imageUrl)}
          sizes={`${size}px`}
          src={imageUrl as string}
          width={size}
        />
      ) : (
        <span className={fallbackStyle}>{symbol.slice(0, 2)}</span>
      )}
    </span>
  );
}
