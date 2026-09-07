import { Check, Circle, Flag, Hourglass, Shield, Star, Trophy, Users, CalendarDays } from "lucide-react";
import type { MatchState, Team } from "@/data/match-broadcast-new";
import { type NameFormat } from "@/lib/playerName";
import { PlayerName } from "./PlayerName";
import FlagImage from "@/components/FlagImage";

type Props = {
  team: Team;
  state: MatchState;
  nameFormat: NameFormat;
};

export function TeamPanel({ team, state, nameFormat }: Props) {
  const isCalling = state === team.tone;
  const isReady = state === "ready";
  const isAwaiting = state === "confirm";
  const otherCalling = (state === "red" || state === "blue") && !isCalling;

  const cls = [
    "team-panel",
    team.tone,
    isCalling ? "active" : "",
    isReady ? "ready" : "",
    isAwaiting ? "awaiting" : "",
    otherCalling ? "dimmed" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={cls} aria-label={team.name}>
      <div className="energy" />

      <header className="team-head">
        <div className="crest">
          {(team.teamLogo || team.crest) ? (
            <img src={team.teamLogo || team.crest} alt={`${team.name} team logo`} width={736} height={912} loading="lazy" />
          ) : <span aria-hidden="true" className="text-2xl font-black opacity-20">{team.tone === 'red' ? 'HONG' : 'CHUNG'}</span>}
        </div>
        <div className="team-title">
          <h2 className="team-name">{team.name}</h2>
          <div className="country">
            <FlagImage
              code={team.countryCode || team.country}
              size={80}
              className="flag-img"
              style={{ width: 'clamp(34px,3.2vw,58px)', height: 'clamp(22px,2vw,38px)' }}
            />
            <span>{team.country}</span>
          </div>

          <div className="stat-card">
            <div className="stat-row">
              <Users size={11} />
              <span>COACH</span>
              <span>{team.coach}</span>
            </div>
            <div className="stat-row accent">
              <Trophy size={11} />
              <span>TEAM RANK</span>
              <span>{team.rank}</span>
            </div>
            <div className="stat-row">
              <Star size={11} />
              <span>POINTS</span>
              <span>{team.points}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="formed">
        FORMED CORNER · <b>{team.cornerClub}</b>
      </div>

      <div className="roster">
        <div className="roster-head">
          <span>#</span>
          <span>ATHLETE</span>
          <span>AGE / GENDER</span>
          <span>CATEGORY</span>
          <span>WEIGHT</span>
          <span>SEED / RANK</span>
          <span>ST</span>
        </div>
        {team.players.map((p, i) => (
          <div className="player-row" key={`${p.name}-${i}`}>
            <span className="pnum">{i + 1}</span>
            <span className="pname">
              <span className="pphoto">
                {p.photo ? (
                  <img src={p.photo} alt="" width={96} height={96} loading="lazy" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                ) : (
                  <b>{p.name.split(" ").slice(0, 2).map((w) => w[0]).join("")}</b>
                )}
              </span>
              <span className="pflag"><FlagImage code={p.countryCode || p.nationality || team.countryCode || team.country} size={40} /></span>
              <span className="ptext"><PlayerName name={p.name} format={nameFormat} /></span>
            </span>
            <span className="pmeta-frame">
              <span><CalendarDays size={10} /> {p.ageGroup || '—'}</span>
              <span><Users size={10} /> {p.gender === 'male' ? 'MALE' : p.gender === 'female' ? 'FEMALE' : p.gender || '—'}</span>
            </span>
            <span className="pcat framed-value">{p.category || '—'}</span>
            <span className="pweight framed-value">{p.weight || '—'}</span>
            <span className="pseed-rank">
              <b>{p.seed}</b>
              <span>{p.rank}</span>
            </span>
            <span className={`pstatus${isReady ? " ok" : ""}`}>
              {isReady ? <Check size={12} /> : <Circle size={8} />}
            </span>
          </div>
        ))}
      </div>


      <div className="team-status">
        <b>
          <Shield size={11} /> {team.players.length} ATHLETES
        </b>
        <span>
          {isReady ? "VERIFIED" : isAwaiting ? "AWAITING CONFIRMATION" : isCalling ? "CALLING NOW" : "AWAITING CALL"}
        </span>
      </div>

      <div className="club-banner">
        {/* Club logo ONLY — never falls back to team.crest/teamLogo, or this
            banner could show the same image as the team crest above. */}
        {team.clubLogo ? <img src={team.clubLogo} alt={`${team.club} logo`} width={736} height={912} loading="lazy" /> : null}
        {team.club || '—'}
        <Flag size={13} />
      </div>

      <div
        className={`status-banner${isReady ? " ready" : isAwaiting ? " awaiting" : isCalling ? " lit" : ""}`}
      >
        {isReady ? (
          <>
            <Check size={15} /> TEAM READY
          </>
        ) : isAwaiting ? (
          <>
            <Hourglass size={14} /> AWAITING CONFIRMATION
          </>
        ) : isCalling ? (
          <>
            <Users size={15} /> CALLING {team.tone === "red" ? "RED" : "BLUE"} TEAM
          </>
        ) : (
          <>
            <Circle size={12} /> STAND BY
          </>
        )}
      </div>
    </section>
  );
}
