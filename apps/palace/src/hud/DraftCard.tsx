"use client";
/**
 * Beat 3: the landlord messages the agent drafted, held for the presenter. Each shows the listing,
 * the recipient, the text, and the rules it relied on; Approve posts to the engine, Skip drops it.
 */
import { approveAllDrafts, approveDraft } from "@/lib/demo";
import { truncate } from "@/lib/format";
import { useBeliefs, useDrafts, usePalaceActions } from "@/lib/store";
import { Chip } from "./Chip";

export function DraftCard() {
  const drafts = useDrafts();
  const beliefs = useBeliefs();
  const { removeDraft, select } = usePalaceActions();
  if (drafts.length === 0) return null;
  const textOf = (id: string): string => truncate(beliefs.find((b) => b.id === id)?.text ?? id, 40);

  return (
    <section className="glass-strong w-80 rounded-2xl p-3.5 text-[13px] leading-5" aria-label="Drafts awaiting approval">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h2 className="font-semibold text-zinc-900">
          {drafts.length} draft{drafts.length === 1 ? "" : "s"} <span className="font-normal text-zinc-600">awaiting approval</span>
        </h2>
        {drafts.length > 1 ? (
          <button type="button" onClick={() => void approveAllDrafts()} className="lift rounded-lg bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600">
            Approve all (A)
          </button>
        ) : null}
      </div>
      <ol className="flex max-h-[min(46vh,520px)] flex-col gap-2.5 overflow-y-auto pr-0.5">
        {drafts.map((d) => (
          <li key={d.draft_id} className="animate-card-enter rounded-xl bg-white/80 p-3 ring-1 ring-inset ring-zinc-900/8">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-medium text-zinc-900">{d.listing_title}</span>
              <span className="shrink-0 text-xs text-zinc-500">to {d.to}</span>
            </div>
            <blockquote className="mt-1.5 border-l-2 border-sky-300 pl-2.5 text-zinc-700">{d.text}</blockquote>
            {d.because.length ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {d.because.map((id) => (
                  <button key={id} type="button" onClick={() => select(id)} className="focus-visible:outline-2 focus-visible:outline-sky-600">
                    <Chip tone="blue" title={id}>
                      {textOf(id)}
                    </Chip>
                  </button>
                ))}
              </div>
            ) : null}
            <div className="mt-2.5 flex gap-2">
              <button type="button" onClick={() => void approveDraft(d.draft_id)} className="lift rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">
                Approve
              </button>
              <button type="button" onClick={() => removeDraft(d.draft_id)} className="lift rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 ring-1 ring-inset ring-zinc-900/10 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-sky-600">
                Skip
              </button>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
