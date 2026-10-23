import { createHash } from "node:crypto";

export const PROMPT_MODE_HEADER = "x-batteryshark-claude-mode";
export const POLICY_HEADER = "x-batteryshark-claude-policy";
export const PROMPT_MODE = "agent-v1";

export function fingerprint(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function parseForkOptions(value: unknown): { overlay: boolean; agent?: string; debug?: boolean } {
  if (value === undefined || (typeof value === "object" && value !== null && Object.keys(value).length === 0)) return { overlay: false };
  if (!value || typeof value !== "object") throw new Error("Invalid Claude fork options");
  const o = value as Record<string, unknown>;
  if (Object.keys(o).every(k => k === "debug")) {
    if (o.debug !== undefined && typeof o.debug !== "boolean") throw new Error("debug must be boolean");
    return { overlay: false, debug: o.debug === true };
  }
  const p = o.systemPrompt as Record<string, unknown> | undefined;
  if (Object.keys(o).some(k => !["routing", "systemPrompt"].includes(k)) || o.routing !== "overlay" ||
      !p || Object.keys(p).some(k => !["agent", "source"].includes(k)) ||
      p.source !== "agent" || p.agent !== "chief-of-staff") {
    throw new Error('Expected {routing:"overlay",systemPrompt:{agent:"chief-of-staff",source:"agent"}}');
  }
  return { overlay: true, agent: p.agent };
}

/** Effective role unchanged; environment belongs in a separate dynamic path. */
export function assembleAgentBase(role: string): string | undefined {
  return role.trim() || undefined;
}
