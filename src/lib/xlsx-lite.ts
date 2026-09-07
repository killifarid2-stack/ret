// Minimal .xlsx (Excel) reader with zero npm dependencies.
//
// .xlsx is a ZIP archive of XML files. We don't have network access to add
// a real library (xlsx/SheetJS) here, and Electron's Chromium runtime
// already ships a native DecompressionStream that understands raw DEFLATE
// — the same compression ZIP uses — so we can read the archive by hand:
//   1. Find the End Of Central Directory record (walk back from EOF).
//   2. Walk the central directory to find sharedStrings.xml and the first
//      worksheet's XML, noting where each one's compressed bytes live.
//   3. Decompress those two entries.
//   4. Pull cell values out of the worksheet XML with a light regex pass
//      (good enough for plain data exports — not a full OOXML parser).
//
// If anything about the file doesn't match this (encrypted, zip64, a
// structure we don't recognize), we throw and the caller shows a clear
// "couldn't read this file" message rather than importing garbage.

function findEOCD(bytes: Uint8Array): number {
  const sig = [0x50, 0x4b, 0x05, 0x06];
  const start = Math.max(0, bytes.length - 65557); // max comment length + EOCD size
  for (let i = bytes.length - 22; i >= start; i--) {
    if (bytes[i] === sig[0] && bytes[i + 1] === sig[1] && bytes[i + 2] === sig[2] && bytes[i + 3] === sig[3]) return i;
  }
  throw new Error('Not a valid .xlsx/zip file (no end-of-central-directory record found)');
}

function readU16(v: DataView, o: number) { return v.getUint16(o, true); }
function readU32(v: DataView, o: number) { return v.getUint32(o, true); }

interface ZipEntry { name: string; method: number; compressedSize: number; localHeaderOffset: number; }

function listZipEntries(bytes: Uint8Array): ZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = findEOCD(bytes);
  const totalEntries = readU16(view, eocd + 10);
  let cdOffset = readU32(view, eocd + 16);
  const entries: ZipEntry[] = [];
  for (let i = 0; i < totalEntries; i++) {
    if (readU32(view, cdOffset) !== 0x02014b50) break; // central directory signature
    const method = readU16(view, cdOffset + 10);
    const compressedSize = readU32(view, cdOffset + 20);
    const nameLen = readU16(view, cdOffset + 28);
    const extraLen = readU16(view, cdOffset + 30);
    const commentLen = readU16(view, cdOffset + 32);
    const localHeaderOffset = readU32(view, cdOffset + 42);
    const name = new TextDecoder().decode(bytes.subarray(cdOffset + 46, cdOffset + 46 + nameLen));
    entries.push({ name, method, compressedSize, localHeaderOffset });
    cdOffset += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

async function extractEntry(bytes: Uint8Array, entry: ZipEntry): Promise<Uint8Array> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const lh = entry.localHeaderOffset;
  if (readU32(view, lh) !== 0x04034b50) throw new Error(`Corrupt local file header for ${entry.name}`);
  const nameLen = readU16(view, lh + 26);
  const extraLen = readU16(view, lh + 28);
  const dataStart = lh + 30 + nameLen + extraLen;
  const compressed = bytes.subarray(dataStart, dataStart + entry.compressedSize);
  if (entry.method === 0) return compressed; // stored, no compression
  if (entry.method !== 8) throw new Error(`Unsupported zip compression method (${entry.method}) for ${entry.name}`);
  // Method 8 = DEFLATE — decompress with the browser-native stream.
  const ds = new DecompressionStream('deflate-raw');
  const stream = new Blob([compressed as unknown as BlobPart]).stream().pipeThrough(ds);
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

function decodeXmlEntities(s: string): string {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

function parseSharedStrings(xml: string): string[] {
  const strings: string[] = [];
  const siBlocks = xml.match(/<si[ >][\s\S]*?<\/si>/g) || [];
  for (const block of siBlocks) {
    const texts = [...block.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(m => decodeXmlEntities(m[1]));
    strings.push(texts.join(''));
  }
  return strings;
}

function colToIndex(colLetters: string): number {
  let n = 0;
  for (const ch of colLetters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function parseSheetRows(xml: string, sharedStrings: string[]): string[][] {
  const rows: string[][] = [];
  const rowBlocks = xml.match(/<row[ >][\s\S]*?<\/row>/g) || [];
  for (const rowXml of rowBlocks) {
    const cells: string[] = [];
    const cellMatches = [...rowXml.matchAll(/<c\s+r="([A-Z]+)\d+"(?:\s+[^>]*?t="([^"]*)")?[^>]*?(?:\/>|>([\s\S]*?)<\/c>)/g)];
    for (const m of cellMatches) {
      const [, colLetters, type, inner] = m;
      const idx = colToIndex(colLetters);
      let value = '';
      if (inner) {
        if (type === 's') {
          const vMatch = inner.match(/<v>([\s\S]*?)<\/v>/);
          value = vMatch ? (sharedStrings[Number(vMatch[1])] ?? '') : '';
        } else if (type === 'str' || type === 'inlineStr') {
          const tMatch = inner.match(/<t[^>]*>([\s\S]*?)<\/t>/) || inner.match(/<v>([\s\S]*?)<\/v>/);
          value = tMatch ? decodeXmlEntities(tMatch[1]) : '';
        } else {
          const vMatch = inner.match(/<v>([\s\S]*?)<\/v>/);
          value = vMatch ? vMatch[1] : '';
        }
      }
      while (cells.length < idx) cells.push('');
      cells[idx] = value;
    }
    rows.push(cells);
  }
  return rows;
}

function parseSheetRowsDetailed(xml: string, sharedStrings: string[]): { rowNumber: number; cells: string[] }[] {
  const rows: { rowNumber: number; cells: string[] }[] = [];
  const rowBlocks = xml.match(/<row\s+[^>]*?r="(\d+)"[^>]*>[\s\S]*?<\/row>|<row\s+[^>]*?r="(\d+)"[^>]*\/>/g) || [];
  for (const rowXml of rowBlocks) {
    const rNumMatch = rowXml.match(/<row\s+[^>]*?r="(\d+)"/);
    const rowNumber = rNumMatch ? Number(rNumMatch[1]) : rows.length + 1;
    const cells: string[] = [];
    const cellMatches = [...rowXml.matchAll(/<c\s+r="([A-Z]+)\d+"(?:\s+[^>]*?t="([^"]*)")?[^>]*?(?:\/>|>([\s\S]*?)<\/c>)/g)];
    for (const m of cellMatches) {
      const [, colLetters, type, inner] = m;
      const idx = colToIndex(colLetters);
      let value = '';
      if (inner) {
        if (type === 's') {
          const vMatch = inner.match(/<v>([\s\S]*?)<\/v>/);
          value = vMatch ? (sharedStrings[Number(vMatch[1])] ?? '') : '';
        } else if (type === 'str' || type === 'inlineStr') {
          const tMatch = inner.match(/<t[^>]*>([\s\S]*?)<\/t>/) || inner.match(/<v>([\s\S]*?)<\/v>/);
          value = tMatch ? decodeXmlEntities(tMatch[1]) : '';
        } else {
          const vMatch = inner.match(/<v>([\s\S]*?)<\/v>/);
          value = vMatch ? vMatch[1] : '';
        }
      }
      while (cells.length < idx) cells.push('');
      cells[idx] = value;
    }
    rows.push({ rowNumber, cells });
  }
  return rows;
}

function detectImageMime(entryName: string): string {
  const ext = entryName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'png': return 'image/png';
    case 'jpg': case 'jpeg': return 'image/jpeg';
    case 'gif': return 'image/gif';
    case 'bmp': return 'image/bmp';
    case 'webp': return 'image/webp';
    default: return 'application/octet-stream';
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/** Resolves a ".rels"-style relative target (e.g. "../media/image1.png")
 *  against the directory the .rels file lives in (e.g. "xl/drawings"),
 *  the way OOXML relationship targets always work. */
function resolveOoxmlPath(fromDir: string, target: string): string {
  const dirParts = fromDir.split('/').filter(Boolean);
  const targetParts = target.split('/').filter(Boolean);
  for (const part of targetParts) {
    if (part === '..') dirParts.pop();
    else if (part !== '.') dirParts.push(part);
  }
  return dirParts.join('/');
}

function parseRelationships(xml: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const m of xml.matchAll(/<Relationship\s+[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"[^>]*\/?>/g)) {
    map.set(m[1], m[2]);
  }
  // Attribute order in a Relationship tag isn't guaranteed — Target can
  // come before Id — so also try the reverse order for anything missed.
  for (const m of xml.matchAll(/<Relationship\s+[^>]*Target="([^"]+)"[^>]*Id="([^"]+)"[^>]*\/?>/g)) {
    if (!map.has(m[2])) map.set(m[2], m[1]);
  }
  return map;
}

/** Best-effort extraction of images embedded directly in the worksheet
 *  (pasted/inserted pictures anchored to a row), mapped by 1-indexed
 *  spreadsheet row number. Only simple "one picture per row" layouts are
 *  resolved reliably — good enough for a player-roster sheet with one
 *  photo per player row. Never throws: any parsing hiccup just yields an
 *  empty map, so a sheet with no images (or images we can't place) still
 *  imports fine via the text columns. */
async function parseXlsxEmbeddedImages(
  bytes: Uint8Array,
  entries: ZipEntry[],
  sheetEntryName: string,
): Promise<Map<number, string>> {
  const imagesByRow = new Map<number, string>();
  try {
    const sheetDir = sheetEntryName.substring(0, sheetEntryName.lastIndexOf('/'));
    const sheetFile = sheetEntryName.substring(sheetEntryName.lastIndexOf('/') + 1);
    const sheetRelsEntry = entries.find(e => e.name === `${sheetDir}/_rels/${sheetFile}.rels`);
    if (!sheetRelsEntry) return imagesByRow;
    const sheetRels = parseRelationships(new TextDecoder().decode(await extractEntry(bytes, sheetRelsEntry)));
    const drawingTarget = [...sheetRels.values()].find(t => /drawing/i.test(t));
    if (!drawingTarget) return imagesByRow;
    const drawingPath = resolveOoxmlPath(sheetDir, drawingTarget);
    const drawingEntry = entries.find(e => e.name === drawingPath);
    if (!drawingEntry) return imagesByRow;
    const drawingDir = drawingPath.substring(0, drawingPath.lastIndexOf('/'));
    const drawingFile = drawingPath.substring(drawingPath.lastIndexOf('/') + 1);
    const drawingRelsEntry = entries.find(e => e.name === `${drawingDir}/_rels/${drawingFile}.rels`);
    if (!drawingRelsEntry) return imagesByRow;
    const drawingRels = parseRelationships(new TextDecoder().decode(await extractEntry(bytes, drawingRelsEntry)));

    const drawingXml = new TextDecoder().decode(await extractEntry(bytes, drawingEntry));
    const anchorBlocks = drawingXml.match(/<xdr:(?:twoCellAnchor|oneCellAnchor)[\s\S]*?<\/xdr:(?:twoCellAnchor|oneCellAnchor)>/g) || [];

    const mediaCache = new Map<string, string>(); // resolved media path -> data URL
    for (const block of anchorBlocks) {
      const rowMatch = block.match(/<xdr:from>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>/);
      const embedMatch = block.match(/r:embed="([^"]+)"/);
      if (!rowMatch || !embedMatch) continue;
      const rowNumber = Number(rowMatch[1]) + 1; // xdr:row is 0-indexed
      const mediaTarget = drawingRels.get(embedMatch[1]);
      if (!mediaTarget) continue;
      const mediaPath = resolveOoxmlPath(drawingDir, mediaTarget);
      let dataUrl = mediaCache.get(mediaPath);
      if (!dataUrl) {
        const mediaEntry = entries.find(e => e.name === mediaPath);
        if (!mediaEntry) continue;
        const mediaBytes = await extractEntry(bytes, mediaEntry);
        dataUrl = `data:${detectImageMime(mediaPath)};base64,${bytesToBase64(mediaBytes)}`;
        mediaCache.set(mediaPath, dataUrl);
      }
      if (!imagesByRow.has(rowNumber)) imagesByRow.set(rowNumber, dataUrl);
    }
  } catch (e) {
    console.error('xlsx embedded image extraction failed (non-fatal):', e);
  }
  return imagesByRow;
}

/** Reads the first worksheet of an .xlsx File and returns its rows as plain string cells. */
export async function parseXlsxFirstSheet(file: File): Promise<string[][]> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const entries = listZipEntries(bytes);
  const sheetEntry = entries.find(e => /^xl\/worksheets\/sheet1\.xml$/i.test(e.name))
    || entries.find(e => /^xl\/worksheets\/.*\.xml$/i.test(e.name));
  if (!sheetEntry) throw new Error('Could not find a worksheet inside this .xlsx file');
  const sharedStringsEntry = entries.find(e => e.name === 'xl/sharedStrings.xml');

  const sheetXml = new TextDecoder().decode(await extractEntry(bytes, sheetEntry));
  const sharedStrings = sharedStringsEntry
    ? parseSharedStrings(new TextDecoder().decode(await extractEntry(bytes, sharedStringsEntry)))
    : [];

  return parseSheetRows(sheetXml, sharedStrings);
}

/** Same as parseXlsxFirstSheet, but also pulls out any pictures embedded
 *  directly in the sheet (inserted/pasted images, as opposed to a "Photo
 *  URL" text column) and returns them mapped by 1-indexed spreadsheet row
 *  number, so a caller can match each image to the same row's player. */
export async function parseXlsxFirstSheetWithImages(file: File): Promise<{ rows: string[][]; rowNumbers: number[]; imagesByRow: Map<number, string> }> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const entries = listZipEntries(bytes);
  const sheetEntry = entries.find(e => /^xl\/worksheets\/sheet1\.xml$/i.test(e.name))
    || entries.find(e => /^xl\/worksheets\/.*\.xml$/i.test(e.name));
  if (!sheetEntry) throw new Error('Could not find a worksheet inside this .xlsx file');
  const sharedStringsEntry = entries.find(e => e.name === 'xl/sharedStrings.xml');

  const sheetXml = new TextDecoder().decode(await extractEntry(bytes, sheetEntry));
  const sharedStrings = sharedStringsEntry
    ? parseSharedStrings(new TextDecoder().decode(await extractEntry(bytes, sharedStringsEntry)))
    : [];

  const detailed = parseSheetRowsDetailed(sheetXml, sharedStrings);
  const imagesByRow = await parseXlsxEmbeddedImages(bytes, entries, sheetEntry.name);

  return {
    rows: detailed.map(d => d.cells),
    rowNumbers: detailed.map(d => d.rowNumber),
    imagesByRow,
  };
}
