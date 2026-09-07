import fs from 'node:fs';
const file = process.env.MAT_CONFIG || 'mat-config.example.json';
if (!fs.existsSync(file)) { console.error(`MAT CONFIG MISSING: ${file}`); process.exit(1); }
const cfg=JSON.parse(fs.readFileSync(file,'utf8'));
for (const k of ['deviceName','matNumber','role','tournamentWallUrl']) if (!cfg[k]) { console.error(`MAT CONFIG MISSING: ${k}`); process.exit(2); }
if (!/^MAT-\d{2}$/.test(String(cfg.matNumber))) { console.error('matNumber must look like MAT-01'); process.exit(3); }
if (!['CONTROL','PUBLIC','HYBRID'].includes(cfg.role)) { console.error('role must be CONTROL, PUBLIC, or HYBRID'); process.exit(4); }
console.log('MAT configuration: PASS', cfg.matNumber, cfg.deviceName);
