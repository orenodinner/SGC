export function readStoredZipEntries(zipBytes: Uint8Array): Map<string, string> {
  const entries = new Map<string, string>();
  const decoder = new TextDecoder();
  let offset = 0;

  while (offset + 30 <= zipBytes.length) {
    const view = new DataView(zipBytes.buffer, zipBytes.byteOffset + offset);
    const signature = view.getUint32(0, true);
    if (signature !== 0x04034b50) {
      break;
    }

    const compressionMethod = view.getUint16(8, true);
    if (compressionMethod !== 0) {
      throw new Error(`Unsupported compression method in test helper: ${compressionMethod}`);
    }

    const fileNameLength = view.getUint16(26, true);
    const extraFieldLength = view.getUint16(28, true);
    const compressedSize = view.getUint32(18, true);
    const nameStart = offset + 30;
    const dataStart = nameStart + fileNameLength + extraFieldLength;
    const dataEnd = dataStart + compressedSize;

    const fileName = decoder.decode(zipBytes.slice(nameStart, nameStart + fileNameLength));
    const data = decoder.decode(zipBytes.slice(dataStart, dataEnd));
    entries.set(fileName, data);

    offset = dataEnd;
  }

  return entries;
}
