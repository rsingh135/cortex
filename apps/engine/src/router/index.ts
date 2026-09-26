/**
 * Request routing: general (no memory), personal (recall), workflow (a learned procedure).
 * docs/spec.md > The agent > Routing. One small claude-sonnet-5 call; a keyword heuristic when
 * no model is configured so fixture mode and tests still route.
 */
import { z } from "zod";
import { RouteResponse, type Procedure } from "@cortex/schema";
import type { Llm } from "../ai/structured.js";

const RouteOutput = z.object({
  route: z.enum(["general", "personal", "workflow"]),
  procedure_name: z.string().nullable(),
});

export type Routed = z.infer<typeof RouteResponse>;
export type ProcedureRef = Pick<Procedure, "_id" | "name" | "description">;

export interface Router {
  route(text: string, procedures: readonly ProcedureRef[]): Promise<Routed>;
}

const PERSONAL = /\b(i|i'm|im|me|my|mine|maya|maya's|we|our|remember|did i|when is|when's|where is|where's|who is|who's|what did|which)\b/i;

/** Deterministic fallback: anything that mentions the user or asks about a specific fact is personal. */
export function heuristicRoute(text: string, procedures: readonly ProcedureRef[]): Routed {
  const lower = text.toLowerCase();
  const procedure = procedures.find((p) => lower.includes(p.name.replace(/_/g, " ")) || lower.includes(p.name));
  if (procedure) return RouteResponse.parse({ route: "workflow", procedure_id: procedure._id });
  if (/\b(find me|book|schedule|run the|do the)\b/i.test(text) && procedures.length > 0)
    return RouteResponse.parse({ route: "workflow", procedure_id: procedures[0]!._id });
  return RouteResponse.parse({ route: PERSONAL.test(text) ? "personal" : "general" });
}

export function createRouter(llm: Llm | null, model = "claude-sonnet-5"): Router {
  return {
    async route(text, procedures) {
      if (!llm) return heuristicRoute(text, procedures);
      const names = procedures.map((p) => `- ${p.name}: ${p.description}`).join("\n") || "- (none learned yet)";
      const result = await llm.parse({
        model,
        maxTokens: 256,
        system: `You route requests to a personal memory system for a user named Maya.
Choose:
- "general": answerable from world knowledge alone, nothing about Maya or her life.
- "personal": needs Maya's memory (her preferences, people, plans, past actions, anything about her).
- "workflow": asks to perform a task that matches one of the learned procedures below by name or description. Never pick workflow when no procedure matches.
Learned procedures:
${names}
Return procedure_name only for workflow, otherwise null.`,
        messages: [{ role: "user", content: text }],
        schema: RouteOutput,
      });
      if (!result.output) return heuristicRoute(text, procedures);
      const { route, procedure_name } = result.output;
      const procedure = procedure_name ? procedures.find((p) => p.name === procedure_name) : undefined;
      if (route === "workflow" && !procedure) return RouteResponse.parse({ route: "personal" });
      return RouteResponse.parse(route === "workflow" ? { route, procedure_id: procedure!._id } : { route });
    },
  };
}
