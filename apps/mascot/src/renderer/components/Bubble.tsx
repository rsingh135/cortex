import type { AskResponse } from "@cortex/schema";

interface BubbleProps {
  answer: AskResponse | null;
  error: string | null;
  thinking: boolean;
}

export function Bubble({ answer, error, thinking }: BubbleProps) {
  if (!answer && !error && !thinking) return null;
  return (
    <div className="relative max-w-[230px] rounded-2xl bg-white/95 px-3 py-2 text-[13px] leading-snug text-zinc-900 shadow-lg ring-1 ring-zinc-200">
      {thinking && <span className="text-zinc-500">thinking…</span>}
      {!thinking && error && <span className="text-red-600">{error}</span>}
      {!thinking && !error && answer && (
        <>
          <p className="whitespace-pre-wrap">{answer.answer}</p>
          <p className="mt-1 text-[11px] text-zinc-500">
            {answer.cited.length === 0 ? "no memories used" : `${answer.cited.length} ${answer.cited.length === 1 ? "memory" : "memories"} used`} · {answer.route}
          </p>
        </>
      )}
      <span className="absolute -left-2 top-4 h-0 w-0 border-y-[7px] border-r-[9px] border-y-transparent border-r-white/95" />
    </div>
  );
}
