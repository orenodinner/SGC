export function readZipEntries(zipBytes: Uint8Array): Map<string, Uint8Array> {
  const entries = new Map<string, Uint8Array>();
  const decoder = new TextDecoder();
  let offset = 0;

  while (offset + 30 <= zipBytes.length) {
    const view = new DataView(zipBytes.buffer, zipBytes.byteOffset + offset);
    const signature = view.getUint32(0, true);
    if (signature !== 0x04034b50) {
      break;
    }

    const compressionMethod = view.getUint16(8, true);
    const fileNameLength = view.getUint16(26, true);
    const extraFieldLength = view.getUint16(28, true);
    const compressedSize = view.getUint32(18, true);
    const nameStart = offset + 30;
    const dataStart = nameStart + fileNameLength + extraFieldLength;
    const dataEnd = dataStart + compressedSize;

    const fileName = decoder.decode(zipBytes.slice(nameStart, nameStart + fileNameLength));
    const compressedData = zipBytes.slice(dataStart, dataEnd);
    entries.set(fileName, decompressZipEntry(compressedData, compressionMethod));

    offset = dataEnd;
  }

  return entries;
}

function decompressZipEntry(data: Uint8Array, compressionMethod: number): Uint8Array {
  if (compressionMethod === 0) {
    return data;
  }

  if (compressionMethod === 8) {
    const inflateRawSync = loadNodeInflateRawSync();
    if (!inflateRawSync) {
      throw new Error("Deflate-compressed ZIP entries are not supported in browser mode");
    }
    const inflated = inflateRawSync(data);
    return new Uint8Array(inflated.buffer, inflated.byteOffset, inflated.byteLength);
  }

  throw new Error(`Unsupported ZIP compression method: ${compressionMethod}`);
}

type InflateRawSync = (data: Uint8Array) => Uint8Array | Buffer;

let cachedInflateRawSync: InflateRawSync | null | undefined;

function loadNodeInflateRawSync(): InflateRawSync | null {
  if (cachedInflateRawSync !== undefined) {
    return cachedInflateRawSync;
  }

  try {
    const dynamicRequire = new Function(
      "return typeof require !== 'undefined' ? require : null;"
    )() as ((id: string) => { inflateRawSync: InflateRawSync }) | null;
    cachedInflateRawSync = dynamicRequire?.("node:zlib").inflateRawSync ?? null;
  } catch {
    cachedInflateRawSync = null;
  }

  return cachedInflateRawSync;
}
