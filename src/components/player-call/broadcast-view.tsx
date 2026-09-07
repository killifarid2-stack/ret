import type { BroadcastState, UpcomingRound } from "@/lib/player-call/types";
import { getFocus, isSideVisible } from "@/lib/player-call/use-broadcast-machine";
import { AnimationTimeline } from "./animation-timeline";
import { BroadcastBackground } from "./broadcast-background";
import { ChampionshipHeader } from "./championship-header";
import { PlayerCard } from "./player-card";
import { QAGuides } from "./qa-guides";
import { RoundCenter } from "./round-center";
import { StatusBar } from "./status-bar";

type Props = {
  data: UpcomingRound;
  state: BroadcastState;
  reducedMotion?: boolean;
  qaMode?: boolean;
  tournamentName?: string;
  showReadyState?: boolean;
};

function redLabel(state: BroadcastState): string | null {
  if (state === "showRedPlayer") return "Player Called";
  if (state === "ready") return "Ready";
  return null;
}
function blueLabel(state: BroadcastState): string | null {
  if (state === "showBluePlayer") return "Player Called";
  if (state === "ready") return "Ready";
  return null;
}

export function BroadcastView({ data, state, reducedMotion = false, qaMode = false, tournamentName, showReadyState = false }: Props) {
  const focus = getFocus(state);

  return (
    <div
      className={`relative h-[1080px] w-[1920px] overflow-hidden bg-[#01030a] font-hud ${reducedMotion ? "pc-reduced" : ""}`}
    >
      <BroadcastBackground state={state} reducedMotion={reducedMotion} />

      <ChampionshipHeader
        eventDate={data.eventDate}
        eventLocation={data.eventLocation}
        tournamentName={tournamentName || data.roundStage}
        tournamentType={data.tournamentType}
        gender={data.gender}
        ageGroup={data.ageGroup}
        division={data.division}
        weightCategory={data.weightCategory}
        matchNumber={data.matchNumber}
        matNumber={data.matNumber}
      />

      <div className="absolute inset-x-0 top-[126px] bottom-[56px] z-20 grid grid-cols-[1fr_500px_1fr] gap-6 px-10">
        <div className="flex items-stretch">
          <PlayerCard
            player={data.redPlayer}
            side="red"
            category={data.category}
            weightCategory={data.weightCategory}
            visible={isSideVisible(state, "red")}
            active={focus === "red" || focus === "both"}
            statusLabel={redLabel(state)}
          />
        </div>

        <RoundCenter
          round={data.round}
          roundStage={data.roundStage}
          category={data.category}
          weightCategory={data.weightCategory}
          matNumber={data.matNumber}
          state={state}
        />

        <div className="flex items-stretch">
          <PlayerCard
            player={data.bluePlayer}
            side="blue"
            category={data.category}
            weightCategory={data.weightCategory}
            visible={isSideVisible(state, "blue")}
            active={focus === "blue" || focus === "both"}
            statusLabel={blueLabel(state)}
          />
        </div>
      </div>

      <AnimationTimeline state={state} round={data.round} />
      <StatusBar state={state} reducedMotion={reducedMotion} />
      {qaMode && <QAGuides />}
    </div>
  );
}
