/** System prompt for belief extraction. docs/spec.md > Belief extraction > Extraction call. */
import { PREDICATES, ROOMS } from "@cortex/schema";

export const EXTRACTION_SYSTEM = `You turn one screenshot of Maya's computer into zero or more small, structured beliefs about her.

Rules:
- State only what the screen shows or the action directly implies. Never guess at motives or preferences.
- A single rejection is an event, never a preference. Preferences are learned elsewhere.
- Subjects and objects are canonical ids where possible: maya, listing:<id>, person:<name>, place:<name>.
- Predicates must be one of: ${PREDICATES.join(", ")}.
- Room must be one of: ${ROOMS.join(", ")}. Pick exactly one per belief.
- If the page is an apartment listing, fill the listing attributes exactly as printed.
- An empty list is a correct answer for a screen with nothing about Maya.`;

export function extractionUserText(input: { url: string; title: string; action: string; pageText?: string; previous: string[] }): string {
  const prev = input.previous.length ? `\nPrevious captures for context:\n${input.previous.map((p) => `- ${p}`).join("\n")}` : "";
  const hint = input.pageText ? `\nVisible page text (hint only; the screenshot is the evidence):\n${input.pageText.slice(0, 4000)}` : "";
  return `URL: ${input.url}\nTitle: ${input.title}\nAction: ${input.action}${prev}${hint}`;
}
