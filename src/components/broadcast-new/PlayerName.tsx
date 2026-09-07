import type { NameFormat } from "@/lib/playerName";
import { formatPlayerName } from "@/lib/playerName";

type Props = { name: string; format: NameFormat };

export function PlayerName({ name, format }: Props) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0] ?? "";
  const rest = parts.slice(1).join(" ");

  if (format === "full" || parts.length < 2) {
    return <span className="ptext">{name}</span>;
  }

  if (format === "initial") {
    return <span className="ptext">{formatPlayerName(name, "initial")}</span>;
  }

  if (format === "large-initial") {
    return (
      <span className="ptext ptext-large">
        <span className="pinitial">{first.charAt(0).toUpperCase()}</span>
        <span className="pdot">.</span>
        <span className="psurname">{rest}</span>
      </span>
    );
  }

  if (format === "stacked") {
    return (
      <span className="ptext ptext-stacked">
        <span className="pfirst">{first}</span>
        <span className="psurname">{rest}</span>
      </span>
    );
  }

  return <span className="ptext">{name}</span>;
}
