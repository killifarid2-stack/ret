/**
 * Minimal, dependency-free .xlsx (Excel OOXML) WRITER.
 *
 * `xlsx-lite.ts` already reads/parses .xlsx files (roster imports etc.), but
 * nothing in this codebase could WRITE one — every "export" (final-reports.ts,
 * OperatorScreen's exportHighlightMarkersCsv, etc.) was actually a .csv file
 * with an .xlsx-shaped name in the UI. A .csv opened in Excel loses column
 * widths, right-to-left text can render oddly with certain locales, and
 * numeric-looking strings (e.g. "07" seed numbers) can get silently coerced.
 * This produces an actual OOXML workbook: a real ZIP (STORED, no compression
 * needed — Excel doesn't require DEFLATE) containing the handful of XML parts
 * every spreadsheet app expects.
 */

// ---------------------------------------------------------------------------
// CRC32 (needed for the ZIP central directory) — standard IEEE polynomial.
let crcTable: Int32Array | null = null;
function crc32(bytes: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      crcTable[n] = c;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function textToBytes(s: string): Uint8Array { return new TextEncoder().encode(s); }

function u16(v: number): number[] { return [v & 0xff, (v >>> 8) & 0xff]; }
function u32(v: number): number[] { return [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff]; }

/** Builds a valid ZIP archive (method 0 = STORED, i.e. uncompressed — simplest
 *  possible encoder, and Excel/LibreOffice/etc. all accept STORED entries). */
function zipStore(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const localParts: number[][] = [];
  const centralParts: number[][] = [];
  let offset = 0;
  const dosTime = 0, dosDate = 0x21; // fixed arbitrary timestamp — content matters, not the mtime

  for (const f of files) {
    const nameBytes = Array.from(textToBytes(f.name));
    const crc = crc32(f.data);
    const size = f.data.length;

    const local = [
      ...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0),
      ...u16(dosTime), ...u16(dosDate),
      ...u32(crc), ...u32(size), ...u32(size),
      ...u16(nameBytes.length), ...u16(0),
      ...nameBytes, ...Array.from(f.data),
    ];
    localParts.push(local);

    const central = [
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0),
      ...u16(dosTime), ...u16(dosDate),
      ...u32(crc), ...u32(size), ...u32(size),
      ...u16(nameBytes.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(0), ...u32(offset),
      ...nameBytes,
    ];
    centralParts.push(central);
    offset += local.length;
  }

  const centralStart = offset;
  const centralBytes = centralParts.flat();
  const end = [
    ...u32(0x06054b50), ...u16(0), ...u16(0),
    ...u16(files.length), ...u16(files.length),
    ...u32(centralBytes.length), ...u32(centralStart), ...u16(0),
  ];

  return new Uint8Array([...localParts.flat(), ...centralBytes, ...end]);
}

// ---------------------------------------------------------------------------
const xmlEscape = (v: unknown): string => String(v ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]!
));

/** One worksheet's worth of data: a header row plus data rows. All cells are
 *  written as inline strings/numbers — no shared-strings table needed, which
 *  keeps this generator simple at the cost of a slightly larger file (fine
 *  for the match/report sizes this app produces — a few hundred rows). */
export interface XlsxSheet {
  name: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
  /** Optional column widths in characters (Excel's width unit). */
  colWidths?: number[];
}

function buildSheetXml(sheet: XlsxSheet): string {
  const colRef = (i: number) => {
    let n = i + 1, s = '';
    while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
    return s;
  };
  const cellXml = (v: string | number | null | undefined, colIdx: number, rowIdx: number, bold = false) => {
    const ref = `${colRef(colIdx)}${rowIdx}`;
    const style = bold ? ' s="1"' : '';
    if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}"${style}><v>${v}</v></c>`;
    return `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${xmlEscape(v)}</t></is></c>`;
  };
  const headerRow = `<row r="1">${sheet.headers.map((h, i) => cellXml(h, i, 1, true)).join('')}</row>`;
  const dataRows = sheet.rows.map((r, ri) => `<row r="${ri + 2}">${r.map((v, ci) => cellXml(v, ci, ri + 2)).join('')}</row>`).join('');
  const cols = sheet.colWidths?.length
    ? `<cols>${sheet.colWidths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>`
    : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `${cols}<sheetData>${headerRow}${dataRows}</sheetData></worksheet>`;
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
  `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
  `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
  `<Default Extension="xml" ContentType="application/xml"/>` +
  `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
  `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
  `{{SHEET_OVERRIDES}}</Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
  `</Relationships>`;

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
  `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
  `<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>` +
  `<fills count="1"><fill><patternFill patternType="none"/></fill></fills>` +
  `<borders count="1"><border/></borders>` +
  `<cellStyleXfs count="1"><xf/></cellStyleXfs>` +
  `<cellXfs count="2"><xf fontId="0"/><xf fontId="1"/></cellXfs>` +
  `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
  `</styleSheet>`;

/** Builds the raw bytes of a multi-sheet .xlsx workbook. */
export function buildXlsxWorkbook(sheets: XlsxSheet[]): Uint8Array {
  const wbSheets = sheets.map((s, i) => `<sheet name="${xmlEscape(s.name).slice(0, 31)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('');
  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheets>${wbSheets}</sheets></workbook>`;

  const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') +
    `<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
    `</Relationships>`;

  const contentTypes = CONTENT_TYPES.replace('{{SHEET_OVERRIDES}}',
    sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join(''));

  const files: { name: string; data: Uint8Array }[] = [
    { name: '[Content_Types].xml', data: textToBytes(contentTypes) },
    { name: '_rels/.rels', data: textToBytes(ROOT_RELS) },
    { name: 'xl/workbook.xml', data: textToBytes(workbookXml) },
    { name: 'xl/_rels/workbook.xml.rels', data: textToBytes(wbRels) },
    { name: 'xl/styles.xml', data: textToBytes(STYLES_XML) },
    ...sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: textToBytes(buildSheetXml(s)) })),
  ];

  return zipStore(files);
}

/** Builds the workbook and triggers a browser download — the write-side
 *  counterpart to parseXlsxFirstSheet() in xlsx-lite.ts. */
export function downloadXlsx(filename: string, sheets: XlsxSheet[]): void {
  const bytes = buildXlsxWorkbook(sheets);
  const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
