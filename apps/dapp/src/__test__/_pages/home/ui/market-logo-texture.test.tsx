import { render } from '@testing-library/react';
import { SRGBColorSpace } from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createSymbolLogoTexture,
  MarketLogoTexture,
} from '@/_pages/home/ui/market-logo-texture';

const textureLoaderMocks = vi.hoisted(() => ({
  errors: [] as string[],
  fail: false,
}));

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();

  class TextureLoader {
    setCrossOrigin() {
      return this;
    }

    load(
      imageUrl: string,
      onLoad: (texture: InstanceType<typeof actual.Texture>) => void,
      _onProgress?: unknown,
      onError?: () => void,
    ) {
      if (textureLoaderMocks.fail) {
        textureLoaderMocks.errors.push(imageUrl);
        onError?.();
      } else {
        onLoad(new actual.Texture());
      }
      return new actual.Texture();
    }
  }

  return { ...actual, TextureLoader };
});

describe('[MarketLogoTexture]', () => {
  beforeEach(() => {
    textureLoaderMocks.errors = [];
    textureLoaderMocks.fail = false;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      fillText: vi.fn(),
      fillStyle: '',
      font: '',
      textAlign: 'center',
      textBaseline: 'middle',
    } as unknown as CanvasRenderingContext2D);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create a local symbol texture when no image URL exists', () => {
    const texture = createSymbolLogoTexture('BTC');
    expect(texture.colorSpace).toBe(SRGBColorSpace);
    expect(texture.image.width).toBe(128);
    texture.dispose();
  });

  it('should keep the symbol disc when the remote logo loader fails', () => {
    textureLoaderMocks.fail = true;
    const { container } = render(
      <MarketLogoTexture
        imageUrl="https://coin-images.coingecko.com/bitcoin.png"
        radius={0.6}
        symbol="BTC"
      />,
    );

    expect(
      container.querySelector('mesh[name="market-logo-BTC"]'),
    ).toBeTruthy();
    expect(textureLoaderMocks.errors).toEqual([
      'https://coin-images.coingecko.com/bitcoin.png',
    ]);
  });
});
