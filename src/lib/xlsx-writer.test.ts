import { describe, it, expect } from 'vitest';
import { buildXlsxWorkbook } from './xlsx-writer';

describe('xlsx-writer', () => {
  it('produces a ZIP with valid local/central signatures and an End Of Central Directory record', () => {
    const bytes = buildXlsxWorkbook([
      { name: 'Matches', headers: ['MATCH', 'WINNER'], rows: [[1, 'CHUNG'], [2, 'HONG']] },
    ]);

    // Local file header signature: PK\x03\x04
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
    expect(bytes[2]).toBe(0x03);
    expect(bytes[3]).toBe(0x04);

    // End Of Central Directory signature (PK\x05\x06) must exist somewhere near the end.
    const tail = Array.from(bytes.slice(-64));
    const eocdIdx = tail.findIndex((_, i) => tail[i] === 0x50 && tail[i + 1] === 0x4b && tail[i + 2] === 0x05 && tail[i + 3] === 0x06);
    expect(eocdIdx).toBeGreaterThanOrEqual(0);
  });

  it('escapes XML special characters in cell text so the workbook stays well-formed', () => {
    const bytes = buildXlsxWorkbook([
      { name: 'Sheet1', headers: ['NAME'], rows: [['<Team> & "Co" \'s']] },
    ]);
    const text = new TextDecoder().decode(bytes);
    expect(text).not.toContain('<Team>');
    expect(text).toContain('&lt;Team&gt;');
  });

  it('supports multiple sheets, each with its own worksheet part', () => {
    const bytes = buildXlsxWorkbook([
      { name: 'Matches', headers: ['A'], rows: [[1]] },
      { name: 'Players', headers: ['B'], rows: [[2]] },
    ]);
    const text = new TextDecoder().decode(bytes);
    expect(text).toContain('sheet1.xml');
    expect(text).toContain('sheet2.xml');
  });
});
