import { inflateSync } from 'node:zlib';

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

export type TPngMetadata = Readonly<{
  width: number;
  height: number;
  bitDepth: number;
  colorType: number;
  opaque: boolean;
}>;

const crc32 = (bytes: Buffer): number => {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const VALID_DEPTHS_BY_COLOR_TYPE: Readonly<
  Record<number, ReadonlySet<number>>
> = Object.freeze({
  0: new Set([1, 2, 4, 8, 16]),
  2: new Set([8, 16]),
  3: new Set([1, 2, 4, 8]),
  4: new Set([8, 16]),
  6: new Set([8, 16]),
});

const CHANNELS_BY_COLOR_TYPE: Readonly<Record<number, number>> = Object.freeze({
  0: 1,
  2: 3,
  3: 1,
  4: 2,
  6: 4,
});
const KNOWN_CRITICAL_CHUNKS = new Set(['IHDR', 'PLTE', 'IDAT', 'IEND']);
const MAX_DECOMPRESSED_BYTES = 128 * 1024 * 1024;
const MAX_COMPRESSED_IDAT_BYTES = 64 * 1024 * 1024;

const fail = (message: string): never => {
  throw new Error(`PNG không hợp lệ: ${message}`);
};

const isAsciiLetterByte = (byte: number): boolean =>
  (byte >= 0x41 && byte <= 0x5a) || (byte >= 0x61 && byte <= 0x7a);

type TInflateInfo = Readonly<{
  buffer: Buffer;
  engine: Readonly<{ bytesWritten: number }>;
}>;

const isInflateInfo = (value: unknown): value is TInflateInfo => {
  if (!value || typeof value !== 'object') return false;
  if (!('buffer' in value) || !Buffer.isBuffer(value.buffer)) return false;
  if (
    !('engine' in value) ||
    !value.engine ||
    typeof value.engine !== 'object'
  ) {
    return false;
  }
  return (
    'bytesWritten' in value.engine &&
    typeof value.engine.bytesWritten === 'number'
  );
};

const validateTransparencyChunk = (
  colorType: number,
  length: number,
  paletteEntries: number,
): void => {
  if (colorType === 0 && length === 2) return;
  if (colorType === 2 && length === 6) return;
  if (
    colorType === 3 &&
    paletteEntries > 0 &&
    length > 0 &&
    length <= paletteEntries
  ) {
    return;
  }
  fail('tRNS không tương thích color type hoặc palette');
};

const inflateImageData = (
  compressed: Buffer,
  maximumOutputLength: number,
): Buffer => {
  try {
    const inflated: unknown = inflateSync(compressed, {
      info: true,
      maxOutputLength: maximumOutputLength,
    });
    if (!isInflateInfo(inflated)) {
      return fail('runtime zlib không trả về thông tin tiêu thụ IDAT');
    }
    if (inflated.engine.bytesWritten !== compressed.length) {
      return fail('IDAT chứa dữ liệu thừa hoặc nhiều luồng zlib');
    }
    return inflated.buffer;
  } catch {
    return fail('IDAT không phải luồng zlib hợp lệ');
  }
};

const validateImageData = (
  metadata: Omit<TPngMetadata, 'opaque'>,
  chunks: readonly Buffer[],
  compressedLength: number,
): void => {
  if (compressedLength === 0 || chunks.length === 0) {
    fail('IDAT rỗng');
  }
  if (compressedLength > MAX_COMPRESSED_IDAT_BYTES) {
    fail('IDAT nén vượt giới hạn an toàn');
  }
  const channels = CHANNELS_BY_COLOR_TYPE[metadata.colorType];
  if (!channels) fail('color type không có cấu trúc scanline');
  const rowBits =
    BigInt(metadata.width) * BigInt(channels) * BigInt(metadata.bitDepth);
  const rowBytes = (rowBits + 7n) / 8n;
  const expectedLength = (rowBytes + 1n) * BigInt(metadata.height);
  if (
    expectedLength <= 0n ||
    expectedLength > BigInt(MAX_DECOMPRESSED_BYTES) ||
    expectedLength > BigInt(Number.MAX_SAFE_INTEGER)
  ) {
    fail('dữ liệu scanline vượt giới hạn an toàn');
  }
  const expectedBytes = Number(expectedLength);
  const imageData = inflateImageData(
    Buffer.concat(chunks, compressedLength),
    expectedBytes + 1,
  );
  if (imageData.length !== expectedBytes) {
    fail('độ dài scanline sau giải nén không khớp IHDR');
  }
  const scanlineBytes = Number(rowBytes) + 1;
  for (let row = 0; row < metadata.height; row += 1) {
    const filter = imageData[row * scanlineBytes];
    if (filter === undefined || filter > 4) {
      fail(`filter byte dòng ${row} không hợp lệ`);
    }
  }
};

export const readPngMetadata = (input: Uint8Array): TPngMetadata => {
  const png = Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  if (
    png.length < PNG_SIGNATURE.length ||
    !png.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)
  ) {
    return fail('sai signature');
  }

  let offset = PNG_SIGNATURE.length;
  let metadata: Omit<TPngMetadata, 'opaque'> | undefined;
  let hasTransparency = false;
  let seenImageData = false;
  let imageDataClosed = false;
  let seenEnd = false;
  let seenPalette = false;
  let paletteEntries = 0;
  let chunkIndex = 0;
  const imageDataChunks: Buffer[] = [];
  let compressedImageDataLength = 0;

  while (offset < png.length) {
    if (png.length - offset < 12) return fail('chunk bị cắt ngắn');
    const length = png.readUInt32BE(offset);
    const typeStart = offset + 4;
    const dataStart = typeStart + 4;
    const crcOffset = dataStart + length;
    const nextOffset = crcOffset + 4;
    if (nextOffset > png.length) return fail('độ dài chunk vượt tệp');

    const rawType = png.subarray(typeStart, dataStart);
    if (rawType.length !== 4 || !rawType.every(isAsciiLetterByte)) {
      return fail('byte tên chunk không phải ASCII A-Z/a-z');
    }
    const type = rawType.toString('ascii');
    if (!/[A-Z]/u.test(type[2] ?? '')) {
      return fail(`reserved bit của chunk ${type} không hợp lệ`);
    }
    if (/[A-Z]/u.test(type[0] ?? '') && !KNOWN_CRITICAL_CHUNKS.has(type)) {
      return fail(`critical chunk ${type} không được hỗ trợ`);
    }
    const expectedCrc = png.readUInt32BE(crcOffset);
    const actualCrc = crc32(png.subarray(typeStart, crcOffset));
    if (actualCrc !== expectedCrc) return fail(`CRC chunk ${type} không khớp`);

    if (chunkIndex === 0 && type !== 'IHDR') {
      return fail('IHDR không phải chunk đầu tiên');
    }
    if (type === 'IHDR') {
      if (metadata || length !== 13) return fail('IHDR trùng hoặc sai độ dài');
      const width = png.readUInt32BE(dataStart);
      const height = png.readUInt32BE(dataStart + 4);
      const bitDepth = png[dataStart + 8];
      const colorType = png[dataStart + 9];
      const compression = png[dataStart + 10];
      const filter = png[dataStart + 11];
      const interlace = png[dataStart + 12];
      if (width === 0 || height === 0) return fail('kích thước bằng 0');
      if (bitDepth === undefined || colorType === undefined) {
        return fail('thiếu metadata IHDR');
      }
      if (!VALID_DEPTHS_BY_COLOR_TYPE[colorType]?.has(bitDepth)) {
        return fail('bit depth và color type không tương thích');
      }
      if (compression !== 0 || filter !== 0) {
        return fail('phương thức PNG không được hỗ trợ');
      }
      if (interlace !== 0) return fail('PNG interlace chưa được hỗ trợ');
      metadata = { width, height, bitDepth, colorType };
    } else if (type === 'PLTE') {
      if (
        !metadata ||
        seenPalette ||
        seenImageData ||
        length === 0 ||
        length % 3 !== 0 ||
        length > 768 ||
        metadata.colorType === 0 ||
        metadata.colorType === 4 ||
        (metadata.colorType === 3 && length / 3 > 2 ** metadata.bitDepth)
      ) {
        return fail('PLTE sai thứ tự, độ dài hoặc color type');
      }
      seenPalette = true;
      paletteEntries = length / 3;
    } else if (type === 'tRNS') {
      if (!metadata || seenImageData || hasTransparency) {
        return fail('tRNS sai thứ tự hoặc bị trùng');
      }
      validateTransparencyChunk(metadata.colorType, length, paletteEntries);
      hasTransparency = true;
    } else if (type === 'IDAT') {
      if (!metadata) return fail('IDAT xuất hiện trước IHDR');
      if (imageDataClosed) return fail('các chunk IDAT không liền nhau');
      if (metadata.colorType === 3 && !seenPalette) {
        return fail('PNG indexed color thiếu PLTE trước IDAT');
      }
      seenImageData = true;
      const imageData = png.subarray(dataStart, crcOffset);
      imageDataChunks.push(imageData);
      compressedImageDataLength += imageData.length;
    } else if (type === 'IEND') {
      if (length !== 0 || !seenImageData) return fail('IEND không hợp lệ');
      seenEnd = true;
      offset = nextOffset;
      break;
    } else if (seenImageData) {
      imageDataClosed = true;
    }

    offset = nextOffset;
    chunkIndex += 1;
  }

  if (!metadata || !seenEnd) return fail('thiếu IHDR hoặc IEND');
  if (offset !== png.length) return fail('có dữ liệu sau IEND');
  validateImageData(metadata, imageDataChunks, compressedImageDataLength);
  return Object.freeze({
    ...metadata,
    opaque:
      metadata.colorType !== 4 && metadata.colorType !== 6 && !hasTransparency,
  });
};
