import { useState } from 'react';
import { css } from '@/styled-system/css';

type TMarketLogoProps = {
  imageUrl?: string;
  name: string;
  symbol: string;
};

const logoFrameCss = css({
  alignItems: 'center',
  bg: 'secondary',
  borderColor: 'border',
  borderWidth: '1px',
  color: 'secondary.foreground',
  display: 'inline-flex',
  flexShrink: '0',
  fontSize: 'xs',
  fontWeight: 'bold',
  h: '9',
  justifyContent: 'center',
  overflow: 'hidden',
  rounded: 'full',
  w: '9',
});

const logoImageCss = css({
  h: 'full',
  objectFit: 'contain',
  p: '0.5',
  w: 'full',
});

export function MarketLogo({ imageUrl, name, symbol }: TMarketLogoProps) {
  const [failedImageUrl, setFailedImageUrl] = useState<string>();

  return (
    <span className={logoFrameCss} aria-hidden="true" title={name}>
      {imageUrl && failedImageUrl !== imageUrl ? (
        <img
          alt=""
          className={logoImageCss}
          decoding="async"
          height={36}
          loading="lazy"
          onError={() => setFailedImageUrl(imageUrl)}
          src={imageUrl}
          width={36}
        />
      ) : (
        symbol.slice(0, 2)
      )}
    </span>
  );
}
