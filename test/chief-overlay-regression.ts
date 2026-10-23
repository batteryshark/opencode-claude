/** Built fork + genuine release modules; all SDK calls are intercepted, never inference. */
import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { bashTool, callTool, interruptibleTurn, mockHandle, textDelta } from "./helpers.ts";

const repo = resolve(import.meta.dir, "..");
mkdirSync(join(repo, ".test-work"), { recursive: true });
const root = mkdtempSync(join(repo, ".test-work", "overlay-"));
const release = "8692d3efc81e486b204d3a27e3d0538df9d7b5c5";
function run(args: string[], cwd = repo) {
  const result = Bun.spawnSync(args, { cwd, stdout: "pipe", stderr: "pipe" });
  assert.equal(result.exitCode, 0, result.stderr.toString());
  return result.stdout.toString();
}
// Compile the actual release, rather than simulating a stock pool/listener.
const stockDir = join(root, "stock");
mkdirSync(stockDir);
for (const file of run(["git", "ls-tree", "-r", "--name-only", release, "src", "package.json", "tsconfig.json"]).trim().split("\n")) {
  mkdirSync(join(stockDir, file, ".."), { recursive: true });
  writeFileSync(join(stockDir, file), run(["git", "show", `${release}:${file}`]));
}
symlinkSync(join(repo, "node_modules"), join(stockDir, "node_modules"));
run([process.execPath, join(repo, "node_modules/typescript/bin/tsc"), "-p", "tsconfig.json"], stockDir);
run([process.execPath, join(repo, "node_modules/typescript/bin/tsc"), "-p", "tsconfig.json"]);

process.env.XDG_DATA_HOME = join(root, "data");
process.env.OPENCHAMBER_RUNTIME = "";
process.env.OPENCODE_CLAUDE_RATE_LIMIT_STORE = join(root, "limits.json");
process.env.OPENCODE_CLAUDE_STOP_GRACE_MS = "10";
process.env.OPENCODE_CLAUDE_RELOAD_GRACE_MS = "100";
const stock = await import(join(stockDir, "dist/index.js"));
const stockProxy = await import(join(stockDir, "dist/proxy.js"));
const stockPool = await import(join(stockDir, "dist/bridge-pool.js"));
(await import(join(stockDir, "dist/detect.js"))).setAuthStatusProbe(() => ({ loggedIn: true, detail: "auth-status-oauth" }));
const stockPort = await stockProxy.acquireProxy();
process.env.OPENCODE_CLAUDE_PROXY_PORT = String(stockPort);
const plugin = await import("../dist/index.js");
const proxy = await import("../dist/proxy.js");
const pool = await import("../dist/bridge-pool.js");
const query = await import("../dist/query.js");
const policy = await import("../dist/prompt-policy.js");
(await import("../dist/detect.js")).setAuthStatusProbe(() => ({ loggedIn: true, detail: "auth-status-oauth" }));
assert.notEqual(stock.default.id, plugin.default.id);
assert.notEqual(stockPool.bridgeRuntime, pool.bridgeRuntime);
assert.throws(() => policy.parseForkOptions({ routing: "overlay" }));
assert.deepEqual(policy.parseForkOptions(undefined), { overlay: false });
const role = "Coordinate work. Retain role safety: protect private data.\nAsk approval for secrets, destruction, publishing and money actions.";
const base = policy.assembleAgentBase(` \n${role}\n `);
assert.equal(base, role, "trim only: retain every inherited role rule without a wrapper paragraph");
assert.equal(base, policy.assembleAgentBase(role));
assert.equal(policy.assembleAgentBase("# Safety\nInherited role constraints."), "# Safety\nInherited role constraints.", "an inherited role safety heading is not removed");
assert.equal(policy.assembleAgentBase(" \n"), undefined);

const envBefore = { ...process.env };
let config = { id: "chief-of-staff", prompt: role };
const directory = join(root, "project");
mkdirSync(directory);
function context(location = directory) {
  let hook: any;
  return {
    hook: () => hook,
    ctx: {
      options: { routing: "overlay", systemPrompt: { agent: "chief-of-staff", source: "agent" } },
      location: { directory: location, project: { id: "project", canonical: location } },
      agent: { get: async () => config },
      provider: { transform: () => { throw new Error("Overlay must not register providers"); } },
      integration: { transform: () => { throw new Error("Overlay must not register auth"); } },
      session: { hook: async (name: string, fn: any, filter: any) => { assert.equal(name, "model.request"); assert.equal(filter.providerID, "claude-code"); hook = fn; } },
      event: { subscribe: ({ signal }: any) => (async function* () { await new Promise(r => signal.addEventListener("abort", r, { once: true })); })() },
    },
  };
}
const c = context();
const dispose = await plugin.default.setup(c.ctx as any);
assert.notEqual(proxy.getProxyPort(), stockPort, "overlay cannot adopt healthy pinned stock listener");
assert.deepEqual({ ...process.env }, envBefore, "setup does not mutate host environment");

async function route(sessionID = "chat", agent = "chief-of-staff", kind = "primary", hook = c.hook()) {
  const request = { sessionID, agent, kind, model: { id: "sonnet", variant: "high" }, baseURL: stockProxy.getClaudeProxyBaseUrl(), headers: {} as Record<string, string> };
  await hook(request);
  return request;
}
for (const [agent, kind] of [["lead", "primary"], ["chief-of-staff", "title"], ["chief-of-staff", "generate"]]) {
  const request = await route("stock", agent, kind);
  assert.equal(request.baseURL, stockProxy.getClaudeProxyBaseUrl());
  assert.deepEqual(request.headers, {});
  assert.deepEqual(request.model, { id: "sonnet", variant: "high" });
}
const observed: any[] = [];
const sdkPrompts: any[] = [];
const sdkOptions: any[] = [];
async function capture(params: any) {
  observed.push(params);
  await query.startClaudeQuery({ ...params, queryImpl: () => (input: any) => {
    sdkPrompts.push(input.options.systemPrompt);
    sdkOptions.push(input.options);
    return (async function* () {})();
  } });
  return mockHandle((async function* () { yield textDelta("OK"); yield { type: "result", is_error: false, usage: {} }; })());
}
proxy.setClaudeQueryStarter(capture);
stockProxy.setClaudeQueryStarter(capture);
function messages(role = config.prompt, facts = { cwd: directory, platform: "darwin", date: "Fri Oct 23 2026", model: "sonnet" }) {
  // Native 2.1.3 identity plugin + environment layout, not a coding prompt copy.
  return [{ role: "system", content: `${role}\n\n# Your Model\n- Name: Claude\n- Provider ID: claude-code\n- Model ID: ${facts.model}\n\nToday's date: ${facts.date}\n\nHere is some useful information about the environment you are running in:\n<env>\n  Working directory: ${facts.cwd}\n  Is directory a git repo: yes\n  Platform: ${facts.platform}\n</env>` }, { role: "user", content: "Reply OK" }];
}
async function post(request: any, msgs = messages(), tools: any[] = []) {
  const response = await fetch(`${request.baseURL}/chat/completions`, {
    method: "POST", headers: { "content-type": "application/json", ...request.headers },
    body: JSON.stringify({ model: request.model.id, stream: false, messages: msgs, tools }),
  });
  assert.equal(response.status, 200, await response.clone().text());
  return await response.json() as any;
}
try {
  // Six-turn adaptation at the real SDK query options boundary.
  const stockRequest = await route("utility", "chief-of-staff", "title");
  stockRequest.headers["x-opencode-claude-kind"] = "title";
  await post(stockRequest);
  const utility = sdkPrompts.at(-1);
  await post(await route("blank"), messages(""));
  const baseline = sdkPrompts.at(-1);
  assert.equal(baseline.preset, "claude_code");
  await post({ baseURL: stockProxy.getClaudeProxyBaseUrl(), model: { id: "sonnet" }, headers: { "x-opencode-claude-kind": "primary", "x-opencode-claude-session": "stock-blank" } }, messages(""));
  assert.deepEqual(sdkPrompts.at(-1), baseline, "blank fork preset is exactly stock");
  await post(await route("blank-spaces"), messages("   "));
  assert.deepEqual(sdkPrompts.at(-1), baseline);
  await post(await route("missing"), [{ role: "user", content: "Reply OK" }]);
  assert.deepEqual(sdkPrompts.at(-1), baseline, "missing role retains exact preset");
  await post(await route());
  const custom = sdkPrompts.at(-1);
  assert.ok(Array.isArray(custom));
  assert.equal(custom[1], "__SYSTEM_PROMPT_DYNAMIC_BOUNDARY__", "literal documented SDK boundary reaches query");
  assert.equal(custom.join("\n").split(config.prompt).length - 1, 1, "effective role appears once");
  for (const text of [role, "protect private data", "Ask approval for secrets, destruction, publishing and money actions.", baseline.append]) assert.ok(custom[0].includes(text), text);
  assert.ok(!custom[0].includes("# Safety"), "no bridge-added safety heading");
  assert.ok(!custom[0].includes("Respect host permissions and user authorization."), "no redundant bridge safety paragraph");
  assert.ok(!custom[0].includes(directory), "cwd is not baked into static prefix");
  assert.ok(!custom[0].includes("Fri Oct 23 2026"), "date is not baked into static prefix");
  for (const text of [directory, "darwin", "Fri Oct 23 2026", "Model ID: sonnet", "Is directory a git repo: yes"]) assert.ok(custom[2].includes(text), text);
  assert.equal(sdkOptions.at(-1).cwd, directory, "cwd remains a separate SDK option");
  assert.equal(sdkOptions.at(-1).model, "sonnet", "model remains a separate SDK option");
  assert.deepEqual(sdkOptions.at(-1).settingSources, ["user", "project", "local"], "authorized SDK loading behavior unchanged");
  await post(await route());
  assert.deepEqual(sdkPrompts.at(-1), custom, "unchanged turn base is deterministic");
  await Promise.all([post(await route("concurrent-a")), post(await route("concurrent-b"))]);
  assert.deepEqual(sdkPrompts.at(-1), custom, "concurrent sessions preserve deterministic base");
  const alternateDir = join(root, "alternate-location");
  mkdirSync(alternateDir);
  const alternate = context(alternateDir);
  const disposeAlternate = await plugin.default.setup(alternate.ctx as any);
  const alternateRequest = await route("alternate", "chief-of-staff", "primary", alternate.hook());
  alternateRequest.model.id = "opus";
  await alternate.hook()(alternateRequest);
  const changedMessages = messages(config.prompt, { cwd: alternateDir, platform: "linux", date: "Sat Oct 24 2026", model: "opus" });
  await post(alternateRequest, changedMessages);
  const changed = sdkPrompts.at(-1);
  assert.equal(changed[0], custom[0], "static prefix unchanged across date/environment/model/Location changes");
  assert.equal(changed[1], custom[1]);
  for (const text of [alternateDir, "linux", "Sat Oct 24 2026", "Model ID: opus"]) assert.ok(changed[2].includes(text), text);
  assert.equal(sdkOptions.at(-1).cwd, alternateDir);
  assert.equal(sdkOptions.at(-1).model, "opus");
  await (disposeAlternate as any)();
  const contextBlock = '<context key="project.guidance">\nKeep session guidance.\n</context>';
  const instructionPath = join(root, "external-instructions.md");
  writeFileSync(instructionPath, "Keep project instructions.");
  const enriched = messages();
  enriched[0]!.content += `\n\n${contextBlock}\n\nInstructions from: ${instructionPath}\nKeep project instructions.`;
  await post(await route("context"), enriched, [bashTool]);
  const withContext = sdkPrompts.at(-1);
  assert.equal(withContext[0], custom[0], "context/tool changes do not change static prefix");
  for (const text of [contextBlock, "Keep project instructions."]) assert.ok(withContext[2].includes(text), text);
  for (const text of ["Built-in Claude Code tools are disabled", "mcp__opencode__"]) assert.ok(withContext[0].includes(text), text);
  const catalog = "# Code Mode\n\n## Available tools\n\n- sample.ping: check a service";
  const skills = "Skills provide specialized instructions and workflows for specific tasks.\n<available_skills>\n<skill>sample-skill</skill>\n</available_skills>";
  const catalogMessages = messages();
  catalogMessages[0]!.content += `\n\n${catalog}\n\n${skills}`;
  await post(await route("catalogs"), catalogMessages, ["execute", "skill"].map(name => ({ ...bashTool, function: { ...bashTool.function, name } })));
  assert.equal(sdkPrompts.at(-1)[0], custom[0], "variable catalogs stay after boundary");
  for (const text of [catalog, skills]) assert.ok(sdkPrompts.at(-1)[2].includes(text), text);
  await post(stockRequest, messages("Other role"));
  assert.equal(sdkPrompts.at(-1), utility, "utility prompt unaffected");
  const compact = await route("chat", "chief-of-staff", "compaction");
  await post(compact, [{ role: "user", content: "Summarize the previous conversation" }]);
  assert.deepEqual(sdkPrompts.at(-1), custom, "compaction without SDK snapshot retains scoped profile");
  config = { ...config, prompt: "Changed role" };
  await post(await route("chat", "chief-of-staff", "compaction"), [{ role: "user", content: "Summarize" }]);
  assert.notDeepEqual(sdkPrompts.at(-1), custom, "changed policy cannot reuse profile");
  config = { ...config, prompt: role };
  await post(await route("reload-profile"));
  const reloadProfile = sdkPrompts.at(-1);

  // Real MCP parking and continuation across fresh built module copies.
  const log: string[] = [];
  proxy.setClaudeQueryStarter(async (params: any) => interruptibleTurn(log, "fork", async function* () {
    const result = await callTool(params, "bash", { command: "pwd" });
    yield textDelta(`done:${result.content[0]?.text}`);
    yield { type: "result", is_error: false, usage: {} };
  }));
  const r = await route("park");
  const first = await post(r, messages(), [bashTool]);
  const call = first.choices[0].message.tool_calls[0];
  assert.equal(first.choices[0].finish_reason, "tool_calls");
  const bridge = [...pool.bridgeRuntime.bridges.values()].find((b: any) => b.nativeSessionID === "park")!;
  assert.ok(bridge);
  assert.equal(stockPool.findBridgeByPendingTool(call.id), undefined, "stock cannot see fork tools");
  stockProxy.setClaudeQueryStarter(async (params: any) => interruptibleTurn(log, "stock", async function* () {
    yield { type: "system", subtype: "init", session_id: "stock-sdk-session" };
    await callTool(params, "bash", { command: "pwd" });
  }));
  const stockTurn = { baseURL: stockProxy.getClaudeProxyBaseUrl(), model: { id: "sonnet" }, headers: {
    "x-opencode-claude-session": "stock-chat", "x-opencode-claude-kind": "primary",
  } };
  const stockFirst = await post(stockTurn, messages(), [bashTool]);
  const stockCall = stockFirst.choices[0].message.tool_calls[0];
  assert.ok(stockPool.findBridgeByPendingTool(stockCall.id));
  assert.equal(pool.findBridgeByPendingTool(stockCall.id), undefined, "fork cannot see real stock parked turn");
  const reloadDir = join(root, "reload");
  cpSync(join(repo, "dist"), join(reloadDir, "dist"), { recursive: true });
  writeFileSync(join(reloadDir, "package.json"), '{"type":"module"}');
  symlinkSync(join(repo, "node_modules"), join(reloadDir, "node_modules"));
  const reloadedPlugin = await import(join(reloadDir, "dist/index.js"));
  const reloaded = await import(join(reloadDir, "dist/proxy.js"));
  const c2 = context();
  await (dispose as any)();
  const dispose2 = await reloadedPlugin.default.setup(c2.ctx);
  reloaded.setClaudeQueryStarter(capture);
  await post(await route("reload-profile", "chief-of-staff", "compaction", c2.hook()), [{ role: "user", content: "Summarize" }]);
  assert.deepEqual(sdkPrompts.at(-1), reloadProfile, "matching boundary-array profile survives module reload for compaction");
  await post(await route("stock-chat", "chief-of-staff", "primary", c2.hook()), [
    ...messages(), { role: "assistant", content: null, tool_calls: [stockCall] },
    { role: "tool", tool_call_id: stockCall.id, content: "stock tool result" },
  ] as any, [bashTool]);
  assert.equal(observed.at(-1).resume, undefined, "no stock SDK snapshot adoption");
  assert.equal(stockPool.findBridgeByPendingTool(stockCall.id).pendingTools.size, 1, "stock parked tool is not resolved by overlay");
  await post(await route("chat", "chief-of-staff", "compaction", c2.hook()), [{ role: "user", content: "Summarize" }]);
  assert.notDeepEqual(sdkPrompts.at(-1), custom, "consumed compaction profile is not revived across reload");
  const continueMessages = [...messages(), { role: "assistant", content: null, tool_calls: [call] }, { role: "tool", tool_call_id: call.id, content: "result" }];
  // Same tool ID in a foreign session/Location/policy must spawn, never resolve the parked call.
  for (const wrong of [await route("foreign", "chief-of-staff", "primary", c2.hook()), { ...await route("park", "chief-of-staff", "primary", c2.hook()), headers: { ...r.headers, [policy.POLICY_HEADER]: "different-policy" } }]) {
    wrong.baseURL = reloaded.getClaudeProxyBaseUrl();
    await post(wrong, continueMessages as any, [bashTool]);
    assert.equal(bridge.pendingTools.size, 1);
  }
  const other = context(join(root, "other-location"));
  const disposeOther = await reloadedPlugin.default.setup(other.ctx);
  await post(await route("park", "chief-of-staff", "primary", other.hook()), continueMessages as any, [bashTool]);
  assert.equal(bridge.pendingTools.size, 1, "Location isolation");
  const count = observed.length;
  const resumed = await post(await route("park", "chief-of-staff", "primary", c2.hook()), continueMessages as any, [bashTool]);
  assert.match(resumed.choices[0].message.content, /done:result/);
  assert.equal(observed.length, count, "reload resumed matching parked turn without new SDK call");
  proxy.setClaudeQueryStarter(async (params: any) => interruptibleTurn(log, "interrupt", async function* () {
    await callTool(params, "bash", { command: "pwd" });
  }));
  reloaded.setClaudeQueryStarter(async (params: any) => interruptibleTurn(log, "interrupt", async function* () {
    await callTool(params, "bash", { command: "pwd" });
  }));
  await post(await route("interrupt-raw", "chief-of-staff", "primary", c2.hook()), messages(), [bashTool]);
  assert.equal(pool.closeSessionBridges("interrupt-raw"), 1, "raw native ID still interrupts a scoped conversation");
  await (disposeOther as any)();
  await (dispose2 as any)();
  assert.deepEqual({ ...process.env }, envBefore, "turns preserve host environment");
  console.log("chief overlay: literal SDK array boundary, static prefix across environment changes, native dynamic facts, stock coexistence, routing, policy/Location/session isolation, compaction and reload passed (no inference; SDK git/auto-memory guidance caveats documented)");
} finally {
  await proxy.stopProxy();
  await stockProxy.releaseProxy();
  await stockProxy.stopProxy();
}
