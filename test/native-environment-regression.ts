import assert from "node:assert/strict";
import { nativeEnvironmentContext } from "../src/opencode-context.ts";

// Native 2.1.3 model-identity and session environment rendering. Fixture facts
// are synthetic; headings, list labels and env layout match the host surface.
const model = "# Your Model\n- Name: Claude\n- Provider ID: claude-code\n- Model ID: opus";
const date = "Today's date: Fri Oct 23 2026";
const env = "<env>\n  Working directory: /project\n  Is directory a git repo: yes\n  Platform: darwin\n</env>";
const known = [model, date, env].join("\n\n");
const coding = "You are an AI agent running in OpenCode.\n# Coding instructions\nDo coding things.";
const system = { role: "system", content: `${coding}\n\n${model}\n\n# Code Mode\nDo not copy this section here.\n\n${date}\n\nHere is some useful information about the environment you are running in:\n${env}` };
assert.equal(nativeEnvironmentContext([system]), known);
assert.equal(nativeEnvironmentContext([{ ...system, content: system.content.replaceAll("\n", "\r\n") }]), known);
assert.equal(nativeEnvironmentContext([{ role: "system", content: coding }, { role: "system", content: known }]), known);
assert.equal(nativeEnvironmentContext([{ role: "user", content: known }]), "");
assert.equal(nativeEnvironmentContext([{ role: "system", content: coding }, { role: "user", content: "hello" }, { role: "system", content: known }]), "");
assert.equal(nativeEnvironmentContext([{ role: "system", content: "# Other section\nNo environment facts." }]), "");
assert.equal(nativeEnvironmentContext([{ role: "system", content: [{ type: "text", text: known }] }]), known);
console.log("native environment: known 2.1.3 sections only, leading system only, CRLF and structured system content passed");
