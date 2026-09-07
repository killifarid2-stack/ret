import {loadAllLocalTournaments,loadTournamentLocal,saveTournamentLocal, TournamentDisplayColors} from '@/lib/tournament-local';
export interface ParEquipeArchivePlayer { id?: string; name: string; nationality?: string; playerNumber?: number; seedNumber?: number; photo?: string; rounds?: number; }
export interface ParEquipeArchiveTeam { id?: string; name: string; teamLogo?: string; clubLogo?: string; club?: string; country?: string; roster: ParEquipeArchivePlayer[]; }
export interface ParEquipeArchiveMatch { id: string; matchNumber?: number; round?: number; matNumber?: number; team1?: string; team2?: string; status?: string; winner?: string; score?: string; weightCategory?: string; ageGroup?: string; gender?: string; stage?: string; tournamentId?: string; }
export interface ParEquipeTournamentArchiveRecord { id: string; tournamentId?: string; tournamentName: string; ageGroup?: string; gender?: 'male'|'female'; weightCategory?: string; division?: string; eventDate?: string; eventLocation?: string; format?: string; playMode?: 'rotation'|'substitution'; displayColors?: TournamentDisplayColors; updatedAt: string; teams: ParEquipeArchiveTeam[]; matches: ParEquipeArchiveMatch[]; }
const KEY='wab-tkd-parequipe-tournament-archive-v2';
function readAll():ParEquipeTournamentArchiveRecord[]{try{const raw=localStorage.getItem(KEY);return raw?JSON.parse(raw):[]}catch{return[];}}
function writeAll(v:ParEquipeTournamentArchiveRecord[]){try{localStorage.setItem(KEY,JSON.stringify(v.slice(0,1000)));}catch{}}
export function listParEquipeTournamentArchive(){return readAll().sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));}
export function getParEquipeTournamentArchive(id:string){return readAll().find(r=>r.id===id)||null;}
export function upsertParEquipeTournamentArchive(input:Omit<ParEquipeTournamentArchiveRecord,'id'|'updatedAt'>&{id?:string}){
 const records=readAll(),name=input.tournamentName.trim()||'Unnamed Tournament';
 const identity=`${name.toLowerCase()}|${input.ageGroup||''}|${input.gender||''}|${input.weightCategory||''}`;
 const existingIndex=records.findIndex(r=>input.id?r.id===input.id:`${r.tournamentName.trim().toLowerCase()}|${r.ageGroup||''}|${r.gender||''}|${r.weightCategory||''}`===identity);
 const previous=existingIndex>=0?records[existingIndex]:undefined; const mergedMatches=[...(previous?.matches||[])];
 for(const m of input.matches||[]){const i=mergedMatches.findIndex(x=>x.id===m.id);if(i>=0)mergedMatches[i]={...mergedMatches[i],...m};else mergedMatches.push(m);}
 const record:ParEquipeTournamentArchiveRecord={...input,id:input.id||previous?.id||crypto.randomUUID(),tournamentName:name,updatedAt:new Date().toISOString(),teams:input.teams.length?input.teams:(previous?.teams||[]),matches:mergedMatches.sort((a,b)=>(a.matchNumber||0)-(b.matchNumber||0))};
 if(existingIndex>=0)records[existingIndex]=record;else records.unshift(record);writeAll(records);return record;
}
export function deleteParEquipeTournamentArchive(id:string){writeAll(readAll().filter(r=>r.id!==id));}
export function clearParEquipeTournamentArchive(){try{localStorage.removeItem(KEY);}catch{}}
export function buildParEquipeArchiveTeams(args:{teams:Array<{id?:string;name:string;photo?:string;clubPhoto?:string;club?:string;country?:string;players?:Array<{id?:string;name:string;nationality?:string;playerNumber?:number;seedNumber?:number;photo?:string;maxRounds?:number;rounds?:number}>}>}):ParEquipeArchiveTeam[]{return args.teams.map(t=>({id:t.id,name:t.name,teamLogo:t.photo,clubLogo:t.clubPhoto,club:t.club,country:t.country,roster:(t.players||[]).map(p=>({id:p.id,name:p.name,nationality:p.nationality,playerNumber:p.playerNumber,seedNumber:p.seedNumber,photo:p.photo,rounds:p.rounds??p.maxRounds}))}));}
function archiveFromTournament(t:any){
 const bd=t?.bracket_data||{};const teams=(t.players||[]).map((team:any)=>({id:team.id,name:team.name,photo:team.teamLogo||team.photo,clubPhoto:team.clubLogo,club:team.club,country:team.nationality,players:bd.teamRosters?.[team.id]||[]}));
 const bracket=Array.isArray(bd.bracket)?bd.bracket:[];const league=Array.isArray(bd.league)?bd.league:[];
 const matches=[...bracket,...league].filter((m:any)=>m&&m.player1&&m.player2&&!m.isBye).map((m:any)=>({id:String(m.id),matchNumber:m.matchNumber??(m.position!=null?m.position+1:undefined),round:m.round,matNumber:m.matNumber,team1:m.player1?.name,team2:m.player2?.name,status:m.winner?'COMPLETED':'READY',winner:m.winner,score:m.score,weightCategory:m.player1?.weight_category||m.player2?.weight_category||t.weight_category,ageGroup:t.age_group,gender:t.gender,stage:m.stage||m.matchStage,tournamentId:t.id}));
 return {tournamentId:t.id,tournamentName:t.name,ageGroup:t.age_group,gender:t.gender,weightCategory:t.weight_category,eventDate:bd.eventDate,eventLocation:bd.eventLocation,division:bd.rules?.division||undefined,format:t.format,playMode:bd.teamPlayMode,displayColors:t.display_colors,teams:buildParEquipeArchiveTeams({teams}),matches};
}
export function syncParEquipeTournamentArchive(tournamentId:string){const t=loadTournamentLocal(tournamentId);if(!t||t.format!=='par_equipe')return null;return upsertParEquipeTournamentArchive(archiveFromTournament(t));}
export function saveParEquipeTournamentArchiveSnapshot(input:{tournamentId?:string;tournamentName:string;ageGroup?:string;gender?:'male'|'female';weightCategory?:string;division?:string;eventDate?:string;eventLocation?:string;format?:string;playMode?:'rotation'|'substitution';displayColors?:TournamentDisplayColors;teams:ParEquipeArchiveTeam[];matches:ParEquipeArchiveMatch[]}){return upsertParEquipeTournamentArchive(input);}
export function syncAllParEquipeTournamentArchives(){return loadAllLocalTournaments().filter(t=>t.format==='par_equipe').map(t=>syncParEquipeTournamentArchive(t.id)).filter(Boolean);}

// --- Local backup / restore for the Par Équipe archive ------------------
// Same idea as Tournament Manager's "نسخة احتياطية" / "استيراد" buttons,
// scoped to this archive's own storage key. Downloads/reads a plain JSON
// file — no cloud sync (that would need its own Supabase wiring, kept out
// of this pass on purpose).
export function exportParEquipeArchiveBackup(){
  const data = readAll();
  const blob = new Blob([JSON.stringify({ key: KEY, exportedAt: new Date().toISOString(), records: data }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `par-equipe-archive-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
export function importParEquipeArchiveBackup(json: string): number {
  const parsed = JSON.parse(json);
  const incoming: ParEquipeTournamentArchiveRecord[] = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.records) ? parsed.records : []);
  if (!incoming.length) return 0;
  const current = readAll();
  let added = 0;
  for (const rec of incoming) {
    if (!rec?.id) continue;
    const idx = current.findIndex(r => r.id === rec.id);
    if (idx >= 0) current[idx] = rec; else { current.unshift(rec); added++; }
  }
  writeAll(current);
  return incoming.length;
}

// --- Generate a match directly from the archive's gender → age → weight
// browser --------------------------------------------------------------
// The operator picks gender/age group/weight (typing a new weight value
// creates that bucket), types only the two team names, and this writes a
// real LocalTournamentRecord (so it shows up under Tournament Manager too,
// per the "طبّقها في بار إيكيب والبطولة أيضاً" request) then re-derives the
// Par Équipe archive record from it via the existing sync path — so both
// views are always generated from the same single source of truth instead
// of two copies that could drift apart.
export function generateParEquipeMatch(input: {
  tournamentName: string; gender: 'male' | 'female'; ageGroup: string; weightCategory: string;
  team1: string; team2: string;
}): ParEquipeTournamentArchiveRecord | null {
  const name = input.tournamentName.trim();
  const team1 = input.team1.trim();
  const team2 = input.team2.trim();
  if (!name || !team1 || !team2 || !input.weightCategory.trim()) return null;

  const all = loadAllLocalTournaments();
  let t = all.find(x =>
    x.format === 'par_equipe' && x.name.trim().toLowerCase() === name.toLowerCase() &&
    x.gender === input.gender && x.age_group === input.ageGroup && x.weight_category === input.weightCategory.trim()
  );

  const bd = t?.bracket_data || { mode: 'league', league: [] };
  if (!Array.isArray(bd.league)) bd.league = [];
  const matchNumber = bd.league.length + 1;
  bd.league.push({
    id: crypto.randomUUID(),
    matchNumber,
    round: 1,
    isBye: false,
    player1: { name: team1, weight_category: input.weightCategory.trim() },
    player2: { name: team2, weight_category: input.weightCategory.trim() },
  });
  bd.mode = 'league';

  if (!t) {
    t = {
      id: `local-${crypto.randomUUID()}`,
      name,
      gender: input.gender,
      weight_category: input.weightCategory.trim(),
      age_group: input.ageGroup,
      format: 'par_equipe',
      bracket_data: bd,
      players: [],
      created_at: new Date().toISOString(),
    };
  } else {
    t = { ...t, bracket_data: bd };
  }
  saveTournamentLocal(t);
  return syncParEquipeTournamentArchive(t.id);
}
