// Sound effects for WAB-TKD scoring system

const audioCtx = () => new AudioContext();

// --- Global mute / master volume -------------------------------------------------
// Persisted in localStorage so the operator's preference survives a reload/
// restart mid-tournament. Each device (Operator tab, Scoreboard tab, Judge
// phone) keeps its own setting, same as sounds are already device-local.
const STORAGE_KEY = 'wab-tkd-sound-settings';

interface SoundSettings { muted: boolean; volume: number; }

function readSettings(): SoundSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { muted: !!parsed.muted, volume: typeof parsed.volume === 'number' ? parsed.volume : 1 };
    }
  } catch {}
  return { muted: false, volume: 1 };
}

let settings: SoundSettings = readSettings();
const listeners = new Set<(s: SoundSettings) => void>();

function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch {}
  listeners.forEach(l => l(settings));
}

export const soundSettings = {
  isMuted: () => settings.muted,
  getVolume: () => settings.volume,
  setMuted: (muted: boolean) => { settings = { ...settings, muted }; persist(); },
  toggleMuted: () => { settings = { ...settings, muted: !settings.muted }; persist(); return settings.muted; },
  setVolume: (volume: number) => { settings = { ...settings, volume: Math.min(1, Math.max(0, volume)) }; persist(); },
  // Subscribe to changes (e.g. to keep a mute-button icon in sync). Returns an unsubscribe fn.
  subscribe: (fn: (s: SoundSettings) => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
};

function beep(freq: number, duration: number, volume = 0.3, type: OscillatorType = 'sine') {
  if (settings.muted) return;
  const effectiveVolume = volume * settings.volume;
  if (effectiveVolume <= 0) return;
  try {
    const ctx = audioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = effectiveVolume;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000);
    setTimeout(() => { osc.stop(); ctx.close(); }, duration);
  } catch {}
}

function multiBeep(freqs: number[], duration: number, gap: number) {
  freqs.forEach((f, i) => setTimeout(() => beep(f, duration), i * gap));
}

// --- Voice announcer (Web Speech API) ---------------------------------------------
// Used for the Player/Team Call cinematic: reads out the athlete's name,
// number, country and club/team so the arena hears the same information the
// public screen shows. Respects the same mute/volume settings as the beep
// sounds above, and always cancels any in-flight utterance first so two
// overlapping calls (e.g. RED called right after BLUE) never talk over each
// other.
function fullCountryName(code?: string): string | undefined {
  if (!code) return undefined;
  try {
    const iso2 = code.length === 2 ? code.toUpperCase() : undefined;
    const target = iso2 || code;
    // Best effort only — if the code isn't ISO-2 and Intl can't resolve it,
    // just fall back to reading the raw code (still intelligible for common
    // 3-letter TKD federation codes like TUR, MAR, FRA).
    const dn = new Intl.DisplayNames(['en'], { type: 'region' });
    const name = iso2 ? dn.of(iso2) : undefined;
    return name || code;
  } catch {
    return code;
  }
}

export const announcer = {
  speak(text: string, opts?: { rate?: number; pitch?: number }) {
    if (settings.muted || settings.volume <= 0) return;
    try {
      if (!window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = opts?.rate ?? 0.92;
      u.pitch = opts?.pitch ?? 1;
      u.volume = settings.volume;
      window.speechSynthesis.speak(u);
    } catch {}
  },
  // Team/club phase: "Now entering, Team X, Club Y, representing Country Z."
  announceTeamCall(args: { teamName?: string; clubName?: string; country?: string; side: 'chung' | 'hong' }) {
    const parts: string[] = [];
    parts.push(args.side === 'hong' ? 'Red corner.' : 'Blue corner.');
    if (args.teamName) parts.push(`Team ${args.teamName}.`);
    if (args.clubName) parts.push(`${args.clubName} club.`);
    const country = fullCountryName(args.country);
    if (country) parts.push(`Representing ${country}.`);
    this.speak(parts.join(' '));
  },
  // Player phase: name, bib number, seed/ranking, nationality, club — read in
  // broadcast-announcer order, e.g.:
  // "Red corner. Fighter number 143. Ali. From Turkey. Team B. HFYFOE club. Seed 324."
  announcePlayerCall(args: {
    side: 'chung' | 'hong';
    playerName?: string;
    playerNumber?: number;
    seedNumber?: number;
    nationality?: string;
    teamName?: string;
    clubName?: string;
    isSubstitution?: boolean;
    outgoingName?: string;
  }) {
    const parts: string[] = [];
    parts.push(args.side === 'hong' ? 'Red corner.' : 'Blue corner.');
    if (args.isSubstitution && args.outgoingName) {
      parts.push(`Substitution. ${args.outgoingName}, replaced by:`);
    }
    if (args.playerNumber != null) parts.push(`Fighter number ${args.playerNumber}.`);
    if (args.playerName) parts.push(`${args.playerName}.`);
    const country = fullCountryName(args.nationality);
    if (country) parts.push(`From ${country}.`);
    if (args.teamName) parts.push(`Team ${args.teamName}.`);
    if (args.clubName) parts.push(`${args.clubName}.`);
    if (args.seedNumber != null) parts.push(`Seed ${args.seedNumber}.`);
    this.speak(parts.join(' '));
  },
  announceMvp(args: { playerName?: string; points?: number }) {
    if (!args.playerName) return;
    const parts = ['Most valuable player.', `${args.playerName}.`];
    if (args.points != null) parts.push(`With ${args.points} points.`);
    this.speak(parts.join(' '), { rate: 0.88, pitch: 1.05 });
  },
  // Next-match call for the mat broadcast/queue screen: fires once, the
  // moment a match becomes first-in-line for a given mat, so coaches and
  // athletes standing near the screen (not staring at it) still hear the
  // call. Deliberately separate from announcePlayerCall — this is a
  // "please make your way to the mat" heads-up, not the on-mat referee
  // call sequence.
  announceNextMatchAlert(args: { matNumber: number; matchNumber?: number; blue?: string; red?: string; lang?: 'ar' | 'en' }) {
    const isAr = args.lang === 'ar';
    const parts = isAr
      ? [`تنبيه. المباراة رقم ${args.matchNumber ?? ''} جاية دابا على البساط ${args.matNumber}.`,
         args.blue ? `${args.blue} ضد ${args.red || ''}.` : '', 'المرجو التوجه للبساط.']
      : [`Attention. Match ${args.matchNumber ?? ''} is next on Mat ${args.matNumber}.`,
         args.blue ? `${args.blue} versus ${args.red || ''}.` : '', 'Please make your way to the mat.'];
    this.speak(parts.filter(Boolean).join(' '), { rate: 0.9 });
  },
};

export const sounds = {
  // Match control
  shijak: () => multiBeep([880, 1100], 150, 100),       // Start/Resume
  kallyeo: () => beep(440, 400, 0.4, 'square'),         // Pause/Stop
  // Next-match-on-deck chime for the mat queue/broadcast screen — a
  // distinct rising two-tone "ding-dong" (not used anywhere else) so it
  // reads as an announcement cue, separate from the scoring beeps.
  nextMatchChime: () => multiBeep([784, 988], 260, 220),
  endRound: () => multiBeep([660, 880, 1100], 200, 150), // Round end
  matchEnd: () => multiBeep([523, 659, 784, 1047], 300, 200), // Match finish (draw/no-winner-fanfare contexts)
  // Distinct celebratory fanfare for the WINNER reveal — longer, richer chord
  // run than the plain matchEnd beep so the decisive moment stands out.
  winner: () => {
    multiBeep([523, 659, 784, 1047, 1319], 220, 140); // rising major arpeggio
    setTimeout(() => multiBeep([784, 1047, 1319], 350, 130), 1100); // triumphant tail
  },
  
  // Scoring
  punch: () => beep(600, 100),
  kick: () => beep(700, 120),
  headKick: () => beep(800, 150, 0.35),
  turningKick: () => beep(900, 180, 0.4),
  turningHead: () => multiBeep([900, 1200], 150, 80),
  gamjeom: () => multiBeep([300, 200], 200, 150),        // Warning sound
  
  // Special events
  ko: () => { beep(200, 600, 0.5, 'sawtooth'); setTimeout(() => beep(150, 800, 0.4, 'sawtooth'), 300); },
  doctor: () => multiBeep([440, 440, 440], 300, 400),
  kyeshi: () => multiBeep([500, 400, 500], 250, 300),
  ivr: () => multiBeep([660, 550, 660], 200, 250),
  
  // UI
  click: () => beep(1000, 50, 0.1),
  success: () => multiBeep([523, 659, 784], 150, 100),
  error: () => beep(200, 300, 0.3, 'square'),
  countdown: () => beep(880, 100, 0.2),
  
  // Score-specific helper
  scoreSound: (type: string) => {
    switch (type) {
      case 'punch': sounds.punch(); break;
      case 'trunk_kick': sounds.kick(); break;
      case 'head_kick': sounds.headKick(); break;
      case 'turning_kick': sounds.turningKick(); break;
      case 'turning_head': sounds.turningHead(); break;
      case 'gamjeom': sounds.gamjeom(); break;
    }
  },
};
