"use client";
import { useMemo, useState } from "react";
import type { Kind, Source } from "@cortex/schema";
import { formatConfidence, formatCount, formatDay } from "@/lib/format";
import { evidenceOf, usePalaceActions, useSnapshot } from "@/lib/store";
import { beliefConfidenceOn } from "@/lib/sweep";
import type { PalaceBelief } from "@/lib/types";
import { Chip } from "./Chip";
import { EvidenceThumb } from "./EvidenceThumb";
import { Sparkline } from "./Sparkline";

const KIND_LABEL: Record<Kind, string> = { fact: "fact", event: "event", person: "person", preference: "preference", routine: "routine", style: "style", summary: "summary" };
const SOURCE_LABEL: Record<Source, string> = { screen: "from screen", voice: "voice note", agent_outcome: "agent outcome", learner: "learned", manual: "edited by Maya" };

const BUTTON = "lift inline-flex h-8 items-center justify-center rounded-lg px-3 text-xs font-medium ring-1 ring-inset focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sky-600 disabled:cursor-not-allowed disabled:opacity-40";
const NEUTRAL = `${BUTTON} bg-white/70 text-zinc-700 ring-zinc-900/10 hover:bg-white hover:text-zinc-900`;
const PRIMARY = `${BUTTON} bg-sky-600 text-white ring-sky-600 hover:bg-sky-700`;
const DANGER = `${BUTTON} bg-red-600 text-white ring-red-600 hover:bg-red-700`;

export interface BeliefCardBodyProps {
  belief: PalaceBelief;
}

export function BeliefCardBody({ belief }: BeliefCardBodyProps) {
  const snapshot = useSnapshot();
  const { select, editBelief, deleteBelief } = usePalaceActions();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(belief.text);
  const [confirming, setConfirming] = useState(false);

  const evidence = useMemo(() => evidenceOf(snapshot, belief), [snapshot, belief]);
  const series = useMemo(() => {
    const days: number[] = [];
    for (let d = belief.createdDay; d <= snapshot.day; d++) days.push(d);
    const values = days.map((d) => (d === snapshot.day ? belief.confidence : beliefConfidenceOn(belief, d)));
    const markers = belief.recallDays.filter((d) => d >= belief.createdDay && d <= snapshot.day).map((d) => d - belief.createdDay);
    return { values, markers };
  }, [belief, snapshot.day]);

  const gold = belief.pinned || belief.source === "voice" || belief.source === "manual";
  const canSave = draft.trim().length > 0 && draft.trim() !== belief.text;

  return (
    <section className="glass-strong w-80 max-w-[calc(100vw-2rem)] rounded-2xl p-4 text-[13px] leading-5" aria-labelledby="belief-card-title">
      <header className="flex items-start gap-2">
        <div className="flex flex-1 flex-wrap gap-1">
          <Chip tone="blue">{KIND_LABEL[belief.kind]}</Chip>
          <Chip>{belief.room}</Chip>
          <Chip title={`Source: ${belief.source}`}>{SOURCE_LABEL[belief.source]}</Chip>
          {belief.inferred && <Chip tone="violet" title="Inferred by the agent, not observed">inferred</Chip>}
          {belief.status !== "active" && <Chip tone={belief.status === "cracked" ? "red" : "neutral"}>{belief.status}</Chip>}
          {gold && (
            <Chip tone="gold" title={belief.pinned ? "Pinned: never decays" : "Human-sourced: decays slowly"}>
              <span aria-hidden>★</span> {belief.pinned ? "pinned" : belief.source}
            </Chip>
          )}
        </div>
        <button type="button" onClick={() => select(null)} aria-label="Close belief card" className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-900/6 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-sky-600">
          <span aria-hidden className="text-base leading-none">
            ×
          </span>
        </button>
      </header>

      {editing ? (
        <form
          className="mt-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!canSave) return;
            editBelief(belief.id, draft);
            setEditing(false);
          }}
        >
          <label htmlFor="belief-edit" className="sr-only">
            Belief text
          </label>
          <textarea id="belief-edit" value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} autoFocus className="w-full resize-y rounded-md border border-zinc-300 p-2 text-sm leading-5 text-zinc-900 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600" />
          <div className="mt-2 flex gap-2">
            <button type="submit" className={PRIMARY} disabled={!canSave}>
              Save
            </button>
            <button type="button" className={NEUTRAL} onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <p id="belief-card-title" className="mt-3 text-[15px] font-medium leading-6 tracking-[-0.01em] text-zinc-900">
          {belief.text}
        </p>
      )}
      {belief.ruleText && <p className="mt-1 text-xs italic leading-5 text-zinc-600">{belief.ruleText}</p>}

      <div className="mt-3">
        <div className="flex items-baseline justify-between text-xs text-zinc-600">
          <span>Confidence</span>
          <span className="font-semibold tabular-nums text-zinc-900">{formatConfidence(belief.confidence)}</span>
        </div>
        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-sky-900/10" role="meter" aria-label="Confidence" aria-valuemin={0} aria-valuemax={1} aria-valuenow={Number(formatConfidence(belief.confidence))}>
          <div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-sky-600 shadow-[0_0_8px_rgba(14,165,233,0.35)] transition-[width] duration-700 ease-spring-soft" style={{ width: `${Math.max(2, belief.confidence * 100)}%` }} />
        </div>
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <div className="text-xs text-zinc-600">Since {formatDay(belief.createdDay)}</div>
          <div className="text-xs text-zinc-600">
            <span className="font-semibold tabular-nums text-zinc-900">{formatCount(belief.recalls, "recall")}</span>
            {belief.lastRecallDay > 0 && <span className="text-zinc-600">, last {formatDay(belief.lastRecallDay).toLowerCase()}</span>}
          </div>
        </div>
        <Sparkline values={series.values} markers={series.markers} width={150} height={34} label={`Confidence from ${formatDay(belief.createdDay)} to ${formatDay(snapshot.day)}; dots mark recalls`} />
      </div>

      <div className="mt-3">
        <div className="text-xs text-zinc-600">{formatCount(evidence.length, "screenshot")} as evidence</div>
        {evidence.length > 0 && (
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            {evidence.slice(0, 6).map((c) => (
              <EvidenceThumb key={c.id} capture={c} />
            ))}
          </div>
        )}
        {evidence.length > 6 && <div className="mt-1 text-xs text-zinc-600">+{evidence.length - 6} more</div>}
      </div>

      <footer className="mt-4 flex items-center gap-2 border-t border-zinc-100 pt-3">
        {confirming ? (
          <>
            <span className="mr-auto text-xs text-red-700">Delete this belief and its orphaned screenshots?</span>
            <button
              type="button"
              className={DANGER}
              onClick={() => {
                deleteBelief(belief.id);
                select(null);
              }}
            >
              Delete
            </button>
            <button type="button" className={NEUTRAL} onClick={() => setConfirming(false)}>
              Keep
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className={NEUTRAL}
              onClick={() => {
                setDraft(belief.text);
                setEditing(true);
              }}
              disabled={editing}
            >
              Edit
            </button>
            <button type="button" className={`${NEUTRAL} text-red-700 hover:bg-red-50`} onClick={() => setConfirming(true)} disabled={editing}>
              Delete
            </button>
          </>
        )}
      </footer>
    </section>
  );
}
