import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { deflateSync } from 'node:zlib';
import {
  OFL_SHA256,
  PLUS_JAKARTA_BASE64,
  PLUS_JAKARTA_FONT_FACE_CSS,
  PLUS_JAKARTA_FONT_FAMILY,
  PLUS_JAKARTA_SHA256,
} from './font.ts';
import { layoutScreen } from './layout-recipes.ts';
import { renderMockup } from './mockup-renderer.ts';
import { readPngMetadata } from './png-metadata.ts';
import { rasterizeSvg } from './rasterize.ts';
import { SCREEN_CONTRACTS } from './screen-contracts.ts';
import { renderWireframe } from './wireframe-renderer.ts';

const EXPECTED_FONT_SHA256 =
  '89b3fb38aa0d275d7a731d0d817a4f1622b316b4d7fbdedcf02ee9099ff68bc8';
const EXPECTED_OFL_SHA256 =
  '995c7199cab65954f545996326755daee7b63cc6b42b06c13da1f9502ab08a99';
const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const MAX_PNG_BYTES = 5 * 1024 * 1024;
const GLYPH_PROBE = ['Điều kiện', 'Tỷ lệ', 'Đối soát'] as const;

const FONT_URL = new URL(
  './fonts/PlusJakartaSans-VariableFont_wght.ttf',
  import.meta.url,
);
const OFL_URL = new URL('./fonts/OFL.txt', import.meta.url);
const RASTERIZER_URL = new URL('./rasterize.ts', import.meta.url);

const sha256 = (bytes: Uint8Array): string =>
  createHash('sha256').update(bytes).digest('hex');

const crc32 = (bytes: Uint8Array): number => {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const pngChunk = (type: string, data = Buffer.alloc(0)): Buffer => {
  assert.match(type, /^[A-Za-z]{4}$/u);
  const typeBytes = Buffer.from(type, 'ascii');
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  typeBytes.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 8 + data.length);
  return chunk;
};

const rgb8Ihdr = (): Buffer => {
  const data = Buffer.alloc(13);
  data.writeUInt32BE(1, 0);
  data.writeUInt32BE(1, 4);
  data[8] = 8;
  data[9] = 2;
  data[10] = 0;
  data[11] = 0;
  data[12] = 0;
  return pngChunk('IHDR', data);
};

const pngFixture = (...chunks: readonly Buffer[]): Buffer =>
  Buffer.concat([PNG_SIGNATURE, rgb8Ihdr(), ...chunks, pngChunk('IEND')]);

const cmapOffset = (font: Buffer): number => {
  const tableCount = font.readUInt16BE(4);
  for (let index = 0; index < tableCount; index += 1) {
    const record = 12 + index * 16;
    if (font.toString('ascii', record, record + 4) === 'cmap') {
      return font.readUInt32BE(record + 8);
    }
  }
  throw new Error('Pinned font has no cmap table');
};

const cmapSubtables = (font: Buffer): readonly number[] => {
  const offset = cmapOffset(font);
  const count = font.readUInt16BE(offset + 2);
  return Array.from({ length: count }, (_, index) => {
    const record = offset + 4 + index * 8;
    return offset + font.readUInt32BE(record + 4);
  }).sort((left, right) => {
    const leftFormat = font.readUInt16BE(left);
    const rightFormat = font.readUInt16BE(right);
    return Number(rightFormat === 12) - Number(leftFormat === 12);
  });
};

const format12HasGlyph = (
  font: Buffer,
  offset: number,
  codePoint: number,
): boolean => {
  const groupCount = font.readUInt32BE(offset + 12);
  for (let index = 0; index < groupCount; index += 1) {
    const group = offset + 16 + index * 12;
    const start = font.readUInt32BE(group);
    const end = font.readUInt32BE(group + 4);
    if (codePoint < start) return false;
    if (codePoint <= end) {
      return font.readUInt32BE(group + 8) + codePoint - start !== 0;
    }
  }
  return false;
};

const format4HasGlyph = (
  font: Buffer,
  offset: number,
  codePoint: number,
): boolean => {
  if (codePoint > 0xffff) return false;
  const segmentCount = font.readUInt16BE(offset + 6) / 2;
  const endCodes = offset + 14;
  const startCodes = endCodes + segmentCount * 2 + 2;
  const deltas = startCodes + segmentCount * 2;
  const rangeOffsets = deltas + segmentCount * 2;
  for (let index = 0; index < segmentCount; index += 1) {
    const end = font.readUInt16BE(endCodes + index * 2);
    const start = font.readUInt16BE(startCodes + index * 2);
    if (codePoint < start || codePoint > end) continue;
    const delta = font.readInt16BE(deltas + index * 2);
    const rangeOffsetAddress = rangeOffsets + index * 2;
    const rangeOffset = font.readUInt16BE(rangeOffsetAddress);
    if (rangeOffset === 0) return ((codePoint + delta) & 0xffff) !== 0;
    const glyphAddress =
      rangeOffsetAddress + rangeOffset + (codePoint - start) * 2;
    const glyph = font.readUInt16BE(glyphAddress);
    return glyph !== 0 && ((glyph + delta) & 0xffff) !== 0;
  }
  return false;
};

const fontHasGlyph = (font: Buffer, codePoint: number): boolean =>
  cmapSubtables(font).some((offset) => {
    const format = font.readUInt16BE(offset);
    if (format === 12) return format12HasGlyph(font, offset, codePoint);
    if (format === 4) return format4HasGlyph(font, offset, codePoint);
    return false;
  });

const safeGlyphProbeSvg =
  (): string => `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1440" viewBox="0 0 1920 1440" role="img" aria-label="Kiểm tra glyph tiếng Việt">
  <defs><style>${PLUS_JAKARTA_FONT_FACE_CSS} text{font-family:'Plus Jakarta Sans'}</style></defs>
  <rect x="0" y="0" width="1920" height="1440" fill="#FFF9F8"/>
  <text x="96" y="320" font-family="Plus Jakarta Sans" font-size="112" fill="#1D1018">Điều kiện</text>
  <text x="96" y="640" font-family="Plus Jakarta Sans" font-size="112" fill="#1D1018">Tỷ lệ</text>
  <text x="96" y="960" font-family="Plus Jakarta Sans" font-size="112" fill="#1D1018">Đối soát</text>
</svg>`;

test('should expose only the exact pinned Plus Jakarta Sans font, license and Vietnamese glyph coverage', async () => {
  const [font, license] = await Promise.all([
    readFile(FONT_URL),
    readFile(OFL_URL),
  ]);
  assert.equal(PLUS_JAKARTA_FONT_FAMILY, 'Plus Jakarta Sans');
  assert.equal(PLUS_JAKARTA_SHA256, EXPECTED_FONT_SHA256);
  assert.equal(OFL_SHA256, EXPECTED_OFL_SHA256);
  assert.equal(sha256(font), EXPECTED_FONT_SHA256);
  assert.equal(sha256(license), EXPECTED_OFL_SHA256);
  assert.deepEqual(Buffer.from(PLUS_JAKARTA_BASE64, 'base64'), font);
  assert.match(
    PLUS_JAKARTA_FONT_FACE_CSS,
    /@font-face\{[^}]*font-family:'Plus Jakarta Sans'[^}]*data:font\/ttf;base64,/u,
  );
  assert.equal(PLUS_JAKARTA_FONT_FACE_CSS.includes(PLUS_JAKARTA_BASE64), true);

  for (const phrase of GLYPH_PROBE) {
    for (const character of phrase.replace(/\s/gu, '')) {
      const codePoint = character.codePointAt(0);
      if (codePoint === undefined) {
        throw new Error(
          `${phrase}: cannot resolve code point for ${character}`,
        );
      }
      assert.equal(
        fontHasGlyph(font, codePoint),
        true,
        `${phrase}: missing glyph U+${codePoint.toString(16).toUpperCase()} (${character})`,
      );
    }
  }
});

test('should rasterize safe SVG deterministically into an opaque RGB8 3840x2880 PNG below 5 MiB', async () => {
  const temporaryDirectory = await mkdtemp(
    join(tmpdir(), 'notion-srs-raster-test-'),
  );
  const firstOutput = join(temporaryDirectory, 'first;literal.png');
  const secondOutput = join(temporaryDirectory, 'second;literal.png');
  try {
    const svg = safeGlyphProbeSvg();
    await rasterizeSvg(svg, firstOutput);
    await rasterizeSvg(svg, secondOutput);
    const [first, second, firstStat] = await Promise.all([
      readFile(firstOutput),
      readFile(secondOutput),
      stat(firstOutput),
    ]);

    assert.deepEqual(first.subarray(0, PNG_SIGNATURE.length), PNG_SIGNATURE);
    assert.equal(sha256(first), sha256(second));
    assert.equal(firstStat.size, first.length);
    assert.ok(first.length < MAX_PNG_BYTES, `${first.length} >= 5 MiB`);
    assert.deepEqual(readPngMetadata(first), {
      width: 3840,
      height: 2880,
      bitDepth: 8,
      colorType: 2,
      opaque: true,
    });
  } finally {
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
});

test('should enforce execFile-style rasterization and reject unsafe SVG before creating output', async () => {
  const source = await readFile(RASTERIZER_URL, 'utf8');
  assert.match(source, /\bexecFile\b/u);
  assert.match(source, /\bmkdtemp\b/u);
  assert.doesNotMatch(source, /\bexec(?:Sync)?\s*\(/u);
  assert.doesNotMatch(source, /\bshell\s*:\s*true\b/u);

  const temporaryDirectory = await mkdtemp(
    join(tmpdir(), 'notion-srs-raster-security-'),
  );
  try {
    const unsafeScenes = [
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1440"><script>bad()</script></svg>`,
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1440"><image href="https://example.com/tracker.png"/></svg>`,
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1440" onload="bad()"></svg>`,
    ];
    for (const [index, svg] of unsafeScenes.entries()) {
      const output = join(temporaryDirectory, `unsafe-${index}.png`);
      await assert.rejects(rasterizeSvg(svg, output), /unsafe|không an toàn/iu);
      await assert.rejects(access(output));
    }
  } finally {
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
});

test('should reject SVGs without exactly the pinned Plus Jakarta font payload before creating output', async () => {
  const alteredBase64 = `${PLUS_JAKARTA_BASE64.slice(0, -1)}${PLUS_JAKARTA_BASE64.endsWith('A') ? 'B' : 'A'}`;
  const exactSvg = safeGlyphProbeSvg();
  const unsafeFontScenes = [
    exactSvg.replace(PLUS_JAKARTA_FONT_FACE_CSS, ''),
    exactSvg.replace(PLUS_JAKARTA_BASE64, alteredBase64),
    exactSvg.replace(
      '</style>',
      ` @font-face{font-family:'Arbitrary';src:url('data:font/ttf;base64,AAAA') format('truetype')}</style>`,
    ),
  ];
  const temporaryDirectory = await mkdtemp(
    join(tmpdir(), 'notion-srs-raster-font-security-'),
  );
  try {
    for (const [index, svg] of unsafeFontScenes.entries()) {
      const output = join(temporaryDirectory, `unsafe-font-${index}.png`);
      await assert.rejects(
        rasterizeSvg(svg, output),
        /font|pinned|không an toàn/iu,
      );
      await assert.rejects(access(output));
    }
  } finally {
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
});

test('should reject commented-out font pins and any non-Plus-Jakarta visible text fallback', async () => {
  const exactSvg = safeGlyphProbeSvg();
  const unsafeFontScenes = [
    exactSvg.replace(
      `<defs><style>${PLUS_JAKARTA_FONT_FACE_CSS}`,
      `<defs><!--${PLUS_JAKARTA_FONT_FACE_CSS}--><style>`,
    ),
    exactSvg.replace(
      PLUS_JAKARTA_FONT_FACE_CSS,
      `/*${PLUS_JAKARTA_FONT_FACE_CSS}*/`,
    ),
    exactSvg
      .replace(
        "text{font-family:'Plus Jakarta Sans'}",
        "text{font-family:'Arial'}",
      )
      .replaceAll('font-family="Plus Jakarta Sans"', 'font-family="Arial"'),
    exactSvg.replace(
      "text{font-family:'Plus Jakarta Sans'}",
      "text{font-family:'Plus Jakarta Sans',sans-serif}",
    ),
  ];
  const temporaryDirectory = await mkdtemp(
    join(tmpdir(), 'notion-srs-raster-font-activation-'),
  );
  try {
    for (const [index, svg] of unsafeFontScenes.entries()) {
      const output = join(temporaryDirectory, `inactive-font-${index}.png`);
      await assert.rejects(
        rasterizeSvg(svg, output),
        /font|pinned|comment|fallback|không an toàn/iu,
      );
      await assert.rejects(access(output));
    }
  } finally {
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
});

test('should reject a font pin that exists only as inert desc text while visible text uses the default family', async () => {
  const inertFontSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1440" viewBox="0 0 1920 1440" role="img" aria-label="Font pin không active">
    <desc>${PLUS_JAKARTA_FONT_FACE_CSS} text{font-family:'Plus Jakarta Sans'}</desc>
    <rect x="0" y="0" width="1920" height="1440" fill="#FFF9F8"/>
    <text x="96" y="320" font-size="112" fill="#1D1018">Điều kiện</text>
  </svg>`;
  const temporaryDirectory = await mkdtemp(
    join(tmpdir(), 'notion-srs-raster-inert-font-'),
  );
  const output = join(temporaryDirectory, 'inert-font.png');
  try {
    await assert.rejects(
      rasterizeSvg(inertFontSvg, output),
      /font|pinned|style|không an toàn/iu,
    );
    await assert.rejects(access(output));
  } finally {
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
});

test('should reject an exact font stylesheet nested inside an inert title container', async () => {
  const inertTitleSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1440" viewBox="0 0 1920 1440" role="img" aria-label="Font pin trong title">
    <title><defs><style>${PLUS_JAKARTA_FONT_FACE_CSS} text{font-family:'Plus Jakarta Sans'}</style></defs></title>
    <rect x="0" y="0" width="1920" height="1440" fill="#FFF9F8"/>
    <text x="96" y="320" font-size="112" fill="#1D1018">Tỷ lệ</text>
  </svg>`;
  const temporaryDirectory = await mkdtemp(
    join(tmpdir(), 'notion-srs-raster-inert-title-'),
  );
  const output = join(temporaryDirectory, 'inert-title.png');
  try {
    await assert.rejects(
      rasterizeSvg(inertTitleSvg, output),
      /font|pinned|style|title|không an toàn/iu,
    );
    await assert.rejects(access(output));
  } finally {
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
});

test('should reject an exact font stylesheet owned by a nested inner svg instead of the root svg', async () => {
  const nestedSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1440" viewBox="0 0 1920 1440" role="img" aria-label="Nested SVG font owner">
    <svg x="0" y="0" width="1920" height="1440">
      <defs><style>${PLUS_JAKARTA_FONT_FACE_CSS} text{font-family:'Plus Jakarta Sans'}</style></defs>
    </svg>
    <rect x="0" y="0" width="1920" height="1440" fill="#FFF9F8"/>
    <text x="96" y="320" font-family="Plus Jakarta Sans" font-size="112" fill="#1D1018">Điều kiện</text>
  </svg>`;
  const temporaryDirectory = await mkdtemp(
    join(tmpdir(), 'notion-srs-raster-nested-svg-'),
  );
  const output = join(temporaryDirectory, 'nested-svg.png');
  try {
    await assert.rejects(
      rasterizeSvg(nestedSvg, output),
      /font|style|nested|root|svg|không an toàn/iu,
    );
    await assert.rejects(access(output));
  } finally {
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
});

test('should reject malformed SVG tag nesting during validation before creating output', async () => {
  const malformedSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1440" viewBox="0 0 1920 1440" role="img" aria-label="XML sai nesting">
    <defs><style>${PLUS_JAKARTA_FONT_FACE_CSS} text{font-family:'Plus Jakarta Sans'}</defs></style>
    <rect x="0" y="0" width="1920" height="1440" fill="#FFF9F8"/>
    <text x="96" y="320" font-family="Plus Jakarta Sans" font-size="112" fill="#1D1018">Đối soát</text>
  </svg>`;
  const temporaryDirectory = await mkdtemp(
    join(tmpdir(), 'notion-srs-raster-malformed-svg-'),
  );
  const output = join(temporaryDirectory, 'malformed.png');
  try {
    await assert.rejects(
      rasterizeSvg(malformedSvg, output),
      /SVG không an toàn:/iu,
    );
    await assert.rejects(access(output));
  } finally {
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
});

test('should continue accepting the active pinned style structures emitted by both renderers', async () => {
  const wireframeScreen = SCREEN_CONTRACTS.find(
    (screen) => screen.code === 'MH-001',
  );
  const mockupScreen = SCREEN_CONTRACTS.find(
    (screen) => screen.code === 'MH-030',
  );
  assert.ok(wireframeScreen);
  assert.ok(mockupScreen);
  const scenes = [
    renderWireframe(
      wireframeScreen,
      layoutScreen(wireframeScreen, 'wireframe'),
      PLUS_JAKARTA_BASE64,
    ),
    renderMockup(
      mockupScreen,
      layoutScreen(mockupScreen, 'high-fidelity'),
      PLUS_JAKARTA_BASE64,
    ),
  ];
  const temporaryDirectory = await mkdtemp(
    join(tmpdir(), 'notion-srs-raster-renderers-'),
  );
  try {
    for (const [index, svg] of scenes.entries()) {
      const output = join(temporaryDirectory, `renderer-${index}.png`);
      await rasterizeSvg(svg, output);
      assert.deepEqual(readPngMetadata(await readFile(output)), {
        width: 3840,
        height: 2880,
        bitDepth: 8,
        colorType: 2,
        opaque: true,
      });
    }
  } finally {
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
});

test('should reject structurally invalid PNG image data even when every chunk CRC is valid', () => {
  const compressedScanline = deflateSync(Buffer.from([0, 0, 0, 0]));
  const split = Math.max(1, Math.floor(compressedScanline.length / 2));
  const highBitIhdr = Buffer.from(rgb8Ihdr());
  highBitIhdr[4] = 0xc9;
  highBitIhdr.writeUInt32BE(crc32(highBitIhdr.subarray(4, 21)), 21);
  const highBitChunkType = Buffer.concat([
    PNG_SIGNATURE,
    highBitIhdr,
    pngChunk('IDAT', compressedScanline),
    pngChunk('IEND'),
  ]);
  const indexedIhdr = Buffer.alloc(13);
  indexedIhdr.writeUInt32BE(1, 0);
  indexedIhdr.writeUInt32BE(1, 4);
  indexedIhdr[8] = 1;
  indexedIhdr[9] = 3;
  const oversizedIndexedPalette = Buffer.concat([
    PNG_SIGNATURE,
    pngChunk('IHDR', indexedIhdr),
    pngChunk('PLTE', Buffer.alloc(9)),
    pngChunk('IDAT', deflateSync(Buffer.from([0, 0]))),
    pngChunk('IEND'),
  ]);
  const fixtures = Object.freeze({
    'empty IDAT': pngFixture(pngChunk('IDAT')),
    'non-zlib IDAT': pngFixture(
      pngChunk('IDAT', Buffer.from([0x00, 0x00, 0x00, 0x00])),
    ),
    'unknown critical ABCD': pngFixture(
      pngChunk('ABCD'),
      pngChunk('IDAT', compressedScanline),
    ),
    'non-contiguous IDAT': pngFixture(
      pngChunk('IDAT', compressedScanline.subarray(0, split)),
      pngChunk('tEXt', Buffer.from('key\0value', 'latin1')),
      pngChunk('IDAT', compressedScanline.subarray(split)),
    ),
    'zlib stream with trailing garbage': pngFixture(
      pngChunk(
        'IDAT',
        Buffer.concat([
          compressedScanline,
          Buffer.from([0xde, 0xad, 0xbe, 0xef]),
        ]),
      ),
    ),
    'second concatenated zlib stream': pngFixture(
      pngChunk(
        'IDAT',
        Buffer.concat([
          compressedScanline,
          deflateSync(Buffer.from([0, 0, 0, 0])),
        ]),
      ),
    ),
    'high-bit chunk type bytes masquerading as IHDR': highBitChunkType,
    'indexed PLTE entries exceed bit-depth capacity': oversizedIndexedPalette,
  });

  for (const [label, fixture] of Object.entries(fixtures)) {
    assert.throws(() => readPngMetadata(fixture), /PNG không hợp lệ/iu, label);
  }
});
