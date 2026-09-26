/**
 * Agent: router (general/personal/workflow), recall, Playwright replay tools with mandatory belief citations, drafts landlord messages for presenter approval, overrides as negative evidence. docs/spec.md > The agent. Uses the Anthropic tool runner (betaZodTool) on claude-opus-5.
 */
import { NotImplemented } from "../lib/errors.js";
import type { Repo } from "../db/repo.js";

export interface AgentModule {
  run(...args: unknown[]): Promise<never>;
}

export function createAgent(_repo: Repo): AgentModule {
  return {
    async run() {
      throw new NotImplemented("agent");
    },
  };
}
