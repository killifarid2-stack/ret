// PDF export utility for match results
export async function exportMatchPDF(matchData: {
  competitionName: string;
  matchNumber: number;
  weightCategory: string;
  chungName: string;
  hongName: string;
  chungNationality: string;
  hongNationality: string;
  chungScore: number;
  hongScore: number;
  chungGamjeom: number;
  hongGamjeom: number;
  winner: string;
  winMethod: string;
  rounds: { round: number; chung: number; hong: number; decisionNote?: string }[];
  /** Main referee's name, shown on the official signature line. Optional —
   *  older call sites that don't pass it just get a blank line to sign by hand. */
  refereeName?: string;
}) {
  const {
    competitionName, matchNumber, weightCategory,
    chungName, hongName, chungNationality, hongNationality,
    chungScore, hongScore, chungGamjeom, hongGamjeom,
    winner, winMethod, rounds, refereeName
  } = matchData;

  // Generate HTML for PDF
  const html = `
<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; background: #fff; color: #111; }
  .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #3B82F6; padding-bottom: 20px; }
  .header h1 { font-size: 28px; color: #3B82F6; margin: 0; }
  .header h2 { font-size: 18px; color: #666; margin: 5px 0; }
  .match-info { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 14px; color: #666; }
  .players { display: flex; justify-content: space-between; align-items: center; margin: 30px 0; }
  .player { text-align: center; flex: 1; }
  .player-name { font-size: 24px; font-weight: bold; margin-bottom: 5px; }
  .player-nat { font-size: 14px; color: #888; }
  .score { font-size: 72px; font-weight: 900; }
  .blue { color: #3B82F6; }
  .red { color: #DC2626; }
  .vs { font-size: 20px; color: #ccc; margin: 0 20px; }
  .rounds-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
  .rounds-table th, .rounds-table td { border: 1px solid #ddd; padding: 12px; text-align: center; }
  .rounds-table th { background: #f5f5f5; font-weight: 600; }
  .winner-box { text-align: center; margin-top: 30px; padding: 20px; border: 3px solid #F59E0B; border-radius: 12px; background: #FFFBEB; }
  .winner-label { font-size: 16px; color: #92400E; }
  .winner-name { font-size: 32px; font-weight: 900; color: #92400E; }
  .win-method { font-size: 14px; color: #B45309; }
  .decision-note { font-size: 11px; color: #999; font-style: italic; }
  .sig-row { display: flex; justify-content: flex-end; width: 100%; margin-top: 50px; }
  .sig { text-align: center; width: 220px; }
  .sig-line { border-top: 1px solid #999; margin-bottom: 6px; }
  .sig-label { font-size: 11px; color: #999; }
  .sig-name { font-size: 13px; color: #333; margin-top: 4px; font-weight: 600; }
  .footer { text-align: center; margin-top: 40px; font-size: 12px; color: #aaa; border-top: 1px solid #eee; padding-top: 15px; }
</style>
</head>
<body>
  <div class="header">
    <h1>🏆 ${competitionName || 'WAB-TKD'}</h1>
    <h2>Match #${matchNumber || '---'} • ${weightCategory || ''}</h2>
  </div>
  
  <div class="players">
    <div class="player">
      <div class="player-name blue">${chungName || 'CHUNG'}</div>
      <div class="player-nat">${chungNationality || 'BLU'}</div>
      <div class="score blue">${chungScore}</div>
      <div style="font-size:14px;color:#888">Gamjeom: ${chungGamjeom}</div>
    </div>
    <div class="vs">VS</div>
    <div class="player">
      <div class="player-name red">${hongName || 'HONG'}</div>
      <div class="player-nat">${hongNationality || 'RED'}</div>
      <div class="score red">${hongScore}</div>
      <div style="font-size:14px;color:#888">Gamjeom: ${hongGamjeom}</div>
    </div>
  </div>

  <table class="rounds-table">
    <tr>
      <th>Round</th>
      <th class="blue">CHUNG</th>
      <th class="red">HONG</th>
      <th>Winner</th>
    </tr>
    ${rounds.map(r => `
    <tr>
      <td>Round ${r.round}</td>
      <td>${r.chung}</td>
      <td>${r.hong}</td>
      <td>${r.chung > r.hong ? '🔵' : r.hong > r.chung ? '🔴' : '—'}</td>
    </tr>
    ${r.decisionNote ? `<tr><td colspan="4" class="decision-note">Round ${r.round}: ${r.decisionNote}</td></tr>` : ''}`).join('')}
  </table>

  <div class="winner-box">
    <div class="winner-label">🏆 WINNER</div>
    <div class="winner-name">${winner === 'chung' ? chungName : hongName}</div>
    <div class="win-method">Win by ${winMethod}</div>
  </div>

  <div class="sig-row">
    <div class="sig">
      <div class="sig-line"></div>
      <div class="sig-label">Main Referee — Signature</div>
      ${refereeName ? `<div class="sig-name">${refereeName}</div>` : ''}
    </div>
  </div>

  <div class="footer">
    WAB-TKD — Taekwondo Protector & Scoring System • Generated ${new Date().toLocaleString()}
  </div>
</body>
</html>`;

  // Open in new window for printing/saving as PDF
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  }
}
