export interface SeedableEntrant { id:string; name:string; nationality:string; club?:string; seedNumber?:number; category?:string; teamLogo?:string; clubLogo?:string; }

function clubKey(player: SeedableEntrant | undefined): string {
  return String(player?.club || '').trim().toLowerCase();
}

/**
 * Keeps seed order as the primary ordering, then distributes same-club
 * entrants so they are not adjacent in the input order. This function does
 * not touch the match engine; it only prepares a fairer entrant list.
 */
export function orderEntrantsForFairBracket(players:SeedableEntrant[]):SeedableEntrant[]{
  const seeded=[...players].sort((a,b)=>{
    const sa=Number.isFinite(a.seedNumber)?Number(a.seedNumber):99999;
    const sb=Number.isFinite(b.seedNumber)?Number(b.seedNumber):99999;
    return sa-sb||a.name.localeCompare(b.name);
  });
  if(seeded.length<3)return seeded;

  const withClub=seeded.filter(p=>clubKey(p));
  const withoutClub=seeded.filter(p=>!clubKey(p));
  const buckets=new Map<string,SeedableEntrant[]>();
  for(const p of withClub){const key=clubKey(p);const bucket=buckets.get(key)||[];bucket.push(p);buckets.set(key,bucket);}

  const result:SeedableEntrant[]=[];
  let previousClub='';
  while(withClub.length || withoutClub.length){
    const candidates=Array.from(buckets.entries())
      .filter(([club,bucket])=>bucket.length>0 && club!==previousClub)
      .sort((a,b)=>b[1].length-a[1].length || a[1][0].name.localeCompare(b[1][0].name));
    const chosen=candidates[0]?.[1]?.shift();
    if(chosen){result.push(chosen);previousClub=clubKey(chosen);const idx=withClub.indexOf(chosen);if(idx>=0)withClub.splice(idx,1);continue;}
    const free=withoutClub.shift();
    if(free){result.push(free);previousClub='';continue;}
    const fallback=Array.from(buckets.values()).find(b=>b.length)?.shift();
    if(fallback){result.push(fallback);previousClub=clubKey(fallback);const idx=withClub.indexOf(fallback);if(idx>=0)withClub.splice(idx,1);}
  }
  return result;
}

/**
 * Re-packs the already-created round-one slots without changing the match
 * engine. The algorithm minimizes same-club pairings and keeps seeded players
 * ahead of unseeded players. If a separation is mathematically impossible,
 * the smallest number of same-club first-round pairings is used.
 */
export function separateSameClubFirstRound<T extends { round:number; position:number; player1?:SeedableEntrant; player2?:SeedableEntrant; isBye:boolean }>(matches:T[], entrants:SeedableEntrant[]):T[]{
  const firstRound=matches.filter(m=>m.round===1).sort((a,b)=>a.position-b.position);
  if(firstRound.length<2 || entrants.length<3)return matches;

  const ordered=orderEntrantsForFairBracket(entrants);
  const remaining=[...ordered];
  const pairs:Array<[SeedableEntrant|undefined,SeedableEntrant|undefined]>=[];

  for(const slot of firstRound){
    if(!remaining.length){pairs.push([undefined,undefined]);continue;}
    const p1=remaining.shift();
    if(!p1){pairs.push([undefined,undefined]);continue;}
    const p1Club=clubKey(p1);
    let partnerIndex=remaining.findIndex(p=>!p1Club || !clubKey(p) || clubKey(p)!==p1Club);
    if(partnerIndex<0) partnerIndex=0;
    const p2=remaining.splice(partnerIndex,1)[0];
    pairs.push([p1,p2]);
  }

  firstRound.forEach((match,index)=>{
    const [player1,player2]=pairs[index]||[undefined,undefined];
    match.player1=player1;
    match.player2=player2;
    match.isBye=!player1 || !player2;
  });
  return matches;
}
