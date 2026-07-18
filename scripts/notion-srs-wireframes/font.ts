import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

export const PLUS_JAKARTA_FONT_FAMILY = 'Plus Jakarta Sans';
export const PLUS_JAKARTA_SHA256 =
  '89b3fb38aa0d275d7a731d0d817a4f1622b316b4d7fbdedcf02ee9099ff68bc8';
export const OFL_SHA256 =
  '995c7199cab65954f545996326755daee7b63cc6b42b06c13da1f9502ab08a99';

const FONT_URL = new URL(
  './fonts/PlusJakartaSans-VariableFont_wght.ttf',
  import.meta.url,
);
const OFL_URL = new URL('./fonts/OFL.txt', import.meta.url);

const sha256 = (bytes: Uint8Array): string =>
  createHash('sha256').update(bytes).digest('hex');

const loadPinnedAsset = (
  url: URL,
  expectedHash: string,
  label: string,
): Buffer => {
  const bytes = readFileSync(url);
  const actualHash = sha256(bytes);
  if (actualHash !== expectedHash) {
    throw new Error(`${label} không khớp SHA-256 đã pin: ${actualHash}`);
  }
  return bytes;
};

const FONT_BYTES = loadPinnedAsset(
  FONT_URL,
  PLUS_JAKARTA_SHA256,
  'Plus Jakarta Sans',
);

// Verify the license beside the font at module load so the raster pipeline
// cannot silently publish an unlicensed or substituted asset.
loadPinnedAsset(OFL_URL, OFL_SHA256, 'OFL license');

export const PLUS_JAKARTA_BASE64 = FONT_BYTES.toString('base64');

export const PLUS_JAKARTA_FONT_FACE_CSS = `@font-face{font-family:'${PLUS_JAKARTA_FONT_FAMILY}';font-style:normal;font-weight:200 800;font-display:block;src:url('data:font/ttf;base64,${PLUS_JAKARTA_BASE64}') format('truetype')}`;
