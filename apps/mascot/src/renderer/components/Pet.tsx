import type { PetState, Reaction } from "../lib/store";

interface PetProps {
  state: PetState;
  reaction: Reaction;
}

const CLASS_BY_STATE: Record<PetState, string> = {
  idle: "pet-idle",
  listening: "pet-listening",
  thinking: "pet-thinking",
  speaking: "pet-speaking",
  reacting: "",
};

/** A soft blob with two eyes. Placeholder body until the mascot track designs the real creature. */
export function Pet({ state, reaction }: PetProps) {
  const cls = state === "reacting" ? (reaction === "shiver" ? "pet-reacting-shiver" : "pet-reacting-nod") : CLASS_BY_STATE[state];
  const mouth = state === "speaking" ? "M40 66 Q52 78 64 66" : state === "thinking" ? "M44 68 L60 68" : "M42 66 Q52 72 62 66";
  const fill = state === "listening" ? "#f59e0b" : state === "thinking" ? "#60a5fa" : "#6366f1";
  return (
    <svg className={cls} width="104" height="96" viewBox="0 0 104 96" role="img" aria-label={`Cortex mascot, ${state}`}>
      <ellipse cx="52" cy="90" rx="30" ry="4" fill="rgba(0,0,0,0.12)" />
      <path d="M52 8 C78 8 96 30 96 56 C96 80 76 90 52 90 C28 90 8 80 8 56 C8 30 26 8 52 8 Z" fill={fill} />
      <g className="pet-eye">
        <ellipse cx="38" cy="48" rx="7" ry="9" fill="#fff" />
        <ellipse cx="66" cy="48" rx="7" ry="9" fill="#fff" />
        <circle cx="39" cy="50" r="3.2" fill="#111827" />
        <circle cx="67" cy="50" r="3.2" fill="#111827" />
      </g>
      <path d={mouth} stroke="#111827" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}
