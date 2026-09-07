// Certificate/diploma PDF export — one printable certificate per medalist,
// generated automatically from the placement records that already get
// written the moment a bracket final (or a league's medal trigger) closes
// (see tournament-placements.ts). No new data model needed: this reads
// PlacementRecord[] that already exists and turns it into print-ready HTML,
// exactly the same "open a window, write HTML, window.print()" pattern
// already used by exportMatchPDF in pdf-export.ts, so the result behaves
// the same way (browser's native "Save as PDF" in the print dialog).

import type { PlacementRecord, Medal } from './tournament-placements';

const MEDAL_LABEL: Record<Medal, string> = {
  gold: 'GOLD MEDAL — 1st Place',
  silver: 'SILVER MEDAL — 2nd Place',
  bronze: 'BRONZE MEDAL — 3rd Place',
};

const MEDAL_EMOJI: Record<Medal, string> = { gold: '🥇', silver: '🥈', bronze: '🥉' };
const MEDAL_COLOR: Record<Medal, string> = { gold: '#D4AF37', silver: '#A8A9AD', bronze: '#CD7F32' };

/**
 * Opens a print window with one certificate page per medal entry across
 * the given placement records (typically: all records for one tournament,
 * or a single record for one weight/age category). Returns the number of
 * certificates generated, or 0 if there was nothing to print.
 */
export function exportCertificatesPdf(records: PlacementRecord[], federationName = 'WAB-TKD'): number {
  const entries = records.flatMap(rec => rec.medals.map(m => ({ rec, m })));
  if (entries.length === 0) return 0;

  const pages = entries.map(({ rec, m }) => `
  <section class="cert">
    <div class="border">
      <div class="emblem">${MEDAL_EMOJI[m.medal]}</div>
      <div class="fed">${federationName}</div>
      <div class="title">CERTIFICATE OF ACHIEVEMENT</div>
      <div class="sub">${[rec.tournamentName, rec.ageGroup, rec.gender, rec.weightCategory].filter(Boolean).join(' • ')}</div>
      <div class="presented">This certificate is proudly presented to</div>
      <div class="name">${escapeHtml(m.playerName || '—')}</div>
      ${m.club ? `<div class="club">${escapeHtml(m.club)}</div>` : ''}
      <div class="medal" style="color:${MEDAL_COLOR[m.medal]}">${MEDAL_LABEL[m.medal]}</div>
      <div class="date">${new Date(rec.recordedAt).toLocaleDateString()}</div>
      <div class="sig-row">
        <div class="sig"><div class="line"></div><div class="sig-label">Main Referee</div></div>
        <div class="sig"><div class="line"></div><div class="sig-label">Tournament Director</div></div>
      </div>
    </div>
  </section>`).join('');

  const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page { size: A4 landscape; margin: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; background: #fff; }
  .cert { width: 297mm; height: 210mm; display: flex; align-items: center; justify-content: center; page-break-after: always; box-sizing: border-box; padding: 12mm; }
  .cert:last-child { page-break-after: auto; }
  .border { width: 100%; height: 100%; border: 3px solid #D4AF37; outline: 1px solid #D4AF37; outline-offset: -8px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 20px; box-sizing: border-box; }
  .emblem { font-size: 56px; margin-bottom: 4px; }
  .fed { font-size: 16px; letter-spacing: 4px; color: #888; font-weight: 700; }
  .title { font-size: 34px; font-weight: 900; color: #1a1a1a; margin: 14px 0 6px; letter-spacing: 2px; }
  .sub { font-size: 13px; color: #999; margin-bottom: 22px; }
  .presented { font-size: 14px; color: #666; font-style: italic; }
  .name { font-size: 40px; font-weight: 800; color: #1a1a1a; margin: 10px 0; border-bottom: 2px solid #eee; padding-bottom: 10px; min-width: 60%; }
  .club { font-size: 15px; color: #888; margin-bottom: 10px; }
  .medal { font-size: 20px; font-weight: 800; margin: 14px 0; letter-spacing: 1px; }
  .date { font-size: 12px; color: #aaa; margin-top: 6px; }
  .sig-row { display: flex; justify-content: space-between; width: 70%; margin-top: 40px; }
  .sig { text-align: center; flex: 1; }
  .line { border-top: 1px solid #999; width: 80%; margin: 0 auto 6px; }
  .sig-label { font-size: 11px; color: #999; }
</style>
</head>
<body>${pages}</body>
</html>`;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  }
  return entries.length;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}
