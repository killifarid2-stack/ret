import { Check, Clock, Gavel, Hourglass, Play, Radio, Users } from "lucide-react";
import trophyUrl from "@/assets/trophy-wab-tkd-transparent.png";
import type { MatchState } from "@/data/match-broadcast-new";
import { useI18n } from "@/lib/i18n";

type Props = {
  state: MatchState;
  round: number;
  onSelectRound: (round: number) => void;
  onStartMatch: () => void;
  /** Head referee unlocks the READY state manually. */
  onConfirm: () => void;
  matchNumber?: number;
  matchClock?: number;
  totalRounds?: number;
};

const getCopy = (ar: boolean): Record<MatchState, { title: string; sub: string; tone: string }> => ({
  waiting: { title: ar ? 'في انتظار الفرق' : 'WAITING FOR TEAMS', sub: ar ? 'يجب على الفريقين الحضور إلى منطقة المنافسة لإجراء الاستدعاء الرسمي.' : 'Both teams must report to the competition area for the official call.', tone: '' },
  red: { title: ar ? 'استدعاء الفريق الأحمر' : 'CALLING RED TEAM', sub: ar ? 'الزاوية الحمراء، يرجى تقديم لاعبيكم إلى منطقة المنافسة.' : 'Red corner, please present your athletes at the competition area.', tone: 'red' },
  blue: { title: ar ? 'استدعاء الفريق الأزرق' : 'CALLING BLUE TEAM', sub: ar ? 'الزاوية الزرقاء، يرجى تقديم لاعبيكم إلى منطقة المنافسة.' : 'Blue corner, please present your athletes at the competition area.', tone: 'blue' },
  confirm: { title: ar ? 'في انتظار التأكيد' : 'AWAITING CONFIRMATION', sub: ar ? 'تم استدعاء الزاويتين. الحكم الرئيسي فقط يمكنه التأكيد وفتح حالة الجاهزية.' : 'Both corners have been called. Only the head referee can confirm and unlock READY.', tone: 'confirm' },
  ready: { title: ar ? 'جميع الفرق جاهزة' : 'ALL TEAMS READY', sub: ar ? 'تم التحقق من الزاويتين. يمكن بدء المباراة بإشارة الحكم.' : "Both corners verified. The match may begin at the referee's signal.", tone: 'ready' },
});


export function CenterMatch({ state, round, onSelectRound, onStartMatch, onConfirm, matchNumber, matchClock, totalRounds }: Props) {
  const { t, lang } = useI18n();
  const c = getCopy(lang === "ar")[state];

  return (
    <section
      className={`center-match${state === "red" ? " calling-red" : state === "blue" ? " calling-blue" : state === "confirm" ? " awaiting" : state === "ready" ? " all-ready" : ""}`}
      aria-live="polite"
    >
      <div className="corner-chips">
        <div
          className={`chip red ${state === "red" ? "on" : state === "blue" ? "off" : ""}`}
        >
          {lang === "ar" ? "أحمر" : "RED"}
          <br />
          {lang === "ar" ? "الزاوية" : "CORNER"}
        </div>
        <div
          className={`chip blue ${state === "blue" ? "on" : state === "red" ? "off" : ""}`}
        >
          {lang === "ar" ? "أزرق" : "BLUE"}
          <br />
          {lang === "ar" ? "الزاوية" : "CORNER"}
        </div>
      </div>

      <div className={`match-number hero ${c.tone}`}>
        <span className="mn-label">{t('match')}</span>
        <span className="mn-value">{matchNumber ?? '—'}</span>
      </div>

      <div className="clock">
        <div className="label">{t('broadcastMatchTime')}</div>
        <div className="time">{typeof matchClock === 'number' ? `${Math.floor(matchClock / 60)}:${String(matchClock % 60).padStart(2, '0')}` : '—'}</div>
        <div className="round">{t('broadcastRound')} {round}</div>
      </div>

      <div className={`call-card ${c.tone}`}>
        <div className="call-title">
          {state === "ready" ? (
            <Check size={20} />
          ) : state === "confirm" ? (
            <Hourglass size={19} />
          ) : state === "waiting" ? (
            <Clock size={19} />
          ) : (
            <Radio size={19} />
          )}
          <span className="stack">{c.title}</span>
        </div>
        <p>{c.sub}</p>
        {state === "ready" ? (
          <button type="button" className="go" onClick={onStartMatch}>
            <Play size={13} /> {lang === "ar" ? "بدء المباراة" : "START MATCH"}
          </button>
        ) : state === "confirm" ? (
          <button type="button" className="await-confirm" onClick={onConfirm}>
            <Gavel size={13} /> {lang === "ar" ? "تأكيد الحكم الرئيسي" : "HEAD REFEREE CONFIRM"}
          </button>
        ) : (
          <button type="button" disabled style={{ opacity: 0.45, cursor: "default" }}>
            <Users size={13} /> {lang === "ar" ? "في انتظار التأكيد" : "AWAITING CONFIRMATION"}
          </button>
        )}
      </div>


      <div className="rounds">
        {Array.from({ length: Math.max(1, totalRounds ?? 1) }).map((_, i) => {
          const n = i + 1;
          return (
            <button
              type="button"
              key={n}
              onClick={() => onSelectRound(n)}
              className={n === round ? (state === "ready" ? "ok" : "selected") : ""}
              aria-label={`${t('broadcastRound')} ${n}`}
            >
              {n}
            </button>
          );
        })}
      </div>

      <div className={`center-trophy hero ${c.tone}`}>
        <span className="trophy-lights" aria-hidden="true" />
        <span className="trophy-beam" aria-hidden="true" />
        <div className="relative h-full w-full">
          {/* Official WAB-TKD trophy from src/assets — one real asset only. */}
          <img src={trophyUrl} alt="Official WAB-TKD championship trophy" className="absolute inset-0 z-[1] h-full w-full object-contain pointer-events-none" draggable={false} />
        </div>
      </div>

      <div className="previous">
        <div className="ptitle">{t('broadcastPreviousMatch')}</div>
        <div className="score">
          <span className="tag red">RED</span>
          <span className="val">—</span>
          <span className="dash">—</span>
          <span className="val">—</span>
          <span className="tag blue">BLUE</span>
        </div>
      </div>
    </section>
  );
}
