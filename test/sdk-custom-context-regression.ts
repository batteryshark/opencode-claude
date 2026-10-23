/** Offline source-boundary proof for the locked SDK, not a live model claim.
 * Execute the packaged runtime's actual context-selection function with stubbed
 * providers. This deliberately fails on a changed SDK layout: re-inspect on update.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const modules = join(import.meta.dir, "..", "node_modules", "@anthropic-ai");
const version = JSON.parse(readFileSync(join(modules, "claude-agent-sdk", "package.json"), "utf8")).version;
assert.equal(version, "0.3.224", "re-inspect runtime context behavior when updating the SDK lock");
const executable = process.platform === "win32" ? "claude.exe" : "claude";
const pkg = `claude-agent-sdk-${process.platform}-${process.arch}`;
const candidates = [join(modules, pkg, executable), join(modules, `${pkg}-musl`, executable)];
const binary = candidates.find(existsSync);
assert.ok(binary, "installed SDK runtime binary required for source-boundary proof");
const source = readFileSync(binary).toString("utf8");
const body = source.match(/async function uXo\(\{tools:[\s\S]*?(?=async function Spa\()/)?.[0];
assert.ok(body, "locked fetchSystemPromptParts implementation must be inspectable");
const calls: string[] = [];
const fetchParts = new Function("R6", "px", "ZP", "D3o", `return (${body});`)(
  async () => { calls.push("preset"); return ["preset system"]; },
  async () => { calls.push("userContext"); return { claudeMd: "loaded memory contents", currentDate: "today" }; },
  async () => { calls.push("gitContext"); return { gitStatus: "status from SDK" }; },
  async () => { calls.push("excludedSections"); return { Environment: "cwd", "auto memory": "path and guidance" }; },
);
const custom = await fetchParts({ customSystemPrompt: ["static", "__SYSTEM_PROMPT_DYNAMIC_BOUNDARY__", "native context"], excludeDynamicSections: true });
assert.deepEqual(calls, ["userContext"], "custom retains independent user context but skips git/preset reinjection");
assert.deepEqual(custom, { defaultSystemPrompt: [], userContext: { claudeMd: "loaded memory contents", currentDate: "today" }, systemContext: {} });
calls.length = 0;
const preset = await fetchParts({ excludeDynamicSections: true });
assert.deepEqual(calls, ["preset", "userContext", "gitContext", "excludedSections"]);
assert.equal(preset.userContext.gitStatus, "status from SDK");
const injectionBody = source.match(/function m9d\(e,t\)\{[\s\S]*?(?=async function vNp\()/)?.[0];
assert.ok(injectionBody);
const inject = new Function("nn", `return (${injectionBody});`)((message: unknown) => message);
const injected = inject([{ content: "user task" }], custom.userContext);
assert.match(injected[0].content, /# claudeMd\nloaded memory contents/);
assert.match(injected[0].content, /# currentDate\ntoday/);
assert.ok(source.includes("messages:m9d(Ot!==void 0?[...pe,Ot]:pe,n),systemPrompt:Fe"), "actual model-call path separately injects user context");

// User-context construction independently loads/formats b1() memory files;
// its suppression is settings/content dependent, not customSystemPrompt dependent.
assert.match(source, /px=en\(async\(\)=>\{[\s\S]{0,350}ARo\(CRo\(await b1\(\)\)\)/);
assert.ok(source.includes('r&&{claudeMd:r}'));
assert.ok(source.includes('t.type!=="AutoMem"'), "auto-memory index has its own filtering policy");
assert.ok(source.includes('i.type==="AutoMem"?" (user\'s auto-memory, persists across conversations)"'));
assert.ok(source.includes('fe=h!==void 0&&Jkn()?await Grn(se):null'), "custom prompt has a separate conditional cowork memory-guidance path, not generic preset equivalence");
console.log("locked SDK source: custom preserves independent CLAUDE/user-context loading; skips ordinary preset git/environment/auto-memory guidance; conditional memory policy remains (no inference or memory traversal)");
