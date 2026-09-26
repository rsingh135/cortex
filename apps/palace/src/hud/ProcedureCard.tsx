"use client";
/** The selected procedure: status, description, numbered steps with the beliefs they use, and what cracked it. */
import type { ProcedureStatus } from "@cortex/schema";
import { truncate } from "@/lib/format";
import { usePalaceActions, useSnapshot } from "@/lib/store";
import type { PalaceProcedure } from "@/lib/types";
import { Chip, type ChipTone } from "./Chip";

const STATUS_TONE: Record<ProcedureStatus, ChipTone> = { active: "blue", cracked: "red" };

export interface ProcedureCardProps {
  procedure: PalaceProcedure;
}

export function ProcedureCard({ procedure }: ProcedureCardProps) {
  const snapshot = useSnapshot();
  const { select } = usePalaceActions();
  const beliefText = (id: string) => snapshot.beliefs.find((b) => b.id === id)?.text;
  const broken = procedure.status === "cracked";

  return (
    <section className="glass-strong w-80 max-w-[calc(100vw-2rem)] rounded-2xl p-4 text-[13px] leading-5" aria-labelledby="procedure-card-title">
      <header className="flex items-start gap-2">
        <div className="flex flex-1 flex-wrap gap-1">
          <Chip tone="blue">procedure</Chip>
          <Chip>{procedure.room}</Chip>
          <Chip tone={STATUS_TONE[procedure.status]}>{procedure.status}</Chip>
        </div>
        <button type="button" onClick={() => select(null)} aria-label="Close procedure card" className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-900/6 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-sky-600">
          <span aria-hidden className="text-base leading-none">
            ×
          </span>
        </button>
      </header>

      <h2 id="procedure-card-title" className="mt-3 text-[15px] font-medium leading-6 tracking-[-0.01em] text-zinc-900">
        {procedure.name}
      </h2>
      {procedure.description && <p className="mt-1 text-[13px] leading-5 text-zinc-600">{procedure.description}</p>}

      {broken && procedure.crackedBy.length > 0 && (
        <div className="mt-3 rounded-lg bg-red-50 p-2.5 text-xs leading-5 text-red-800 ring-1 ring-inset ring-red-200">
          <div className="font-semibold">Cracked by</div>
          <ul className="mt-0.5 list-disc pl-4">
            {procedure.crackedBy.map((id) => (
              <li key={id}>
                <button type="button" onClick={() => select(id)} className="text-left underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-sky-600">
                  {truncate(beliefText(id) ?? id, 70)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ol className="mt-3 space-y-2" aria-label="Steps">
        {procedure.steps.map((step) => (
          <li key={step.n} className="flex gap-2">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-900/8 text-[11px] font-semibold tabular-nums text-zinc-700">{step.n}</span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] leading-5 text-zinc-900">{step.do}</div>
              {step.uses.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {step.uses.map((id) => {
                    const text = beliefText(id);
                    const cracked = procedure.crackedBy.includes(id);
                    return (
                      <button key={id} type="button" onClick={() => select(id)} title={text ?? id} className={`lift max-w-full truncate rounded-full px-2 py-0.5 text-[11px] leading-4 ring-1 ring-inset hover:bg-white focus-visible:outline-2 focus-visible:outline-sky-600 ${cracked ? "bg-red-50 text-red-800 ring-red-200 line-through" : "bg-zinc-900/6 text-zinc-700 ring-zinc-900/10"}`}>
                        {truncate(text ?? "missing belief", 36)}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
