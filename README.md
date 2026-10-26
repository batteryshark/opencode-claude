# opencode-claude

Use a Claude Pro or Max plan in OpenCode through the official Claude Agent SDK and your locally installed Claude Code CLI. The plugin adds a Claude Code provider, streams responses and tool calls back to OpenCode, and keeps authentication with the CLI. This repository is a fork of [openchamber/opencode-claude](https://github.com/openchamber/opencode-claude).

## Requirements

- OpenCode 2.x.
- Node.js 18+ and the Claude Code CLI signed in to a Claude plan.
- Bun to build this checkout.

Console API-key, Bedrock and Vertex authentication are not supported by this plugin. This is an independent community project, not affiliated with or supported by Anthropic. Review the [Claude-plan usage guidance](https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan).

## Install

For the published upstream package:

```sh
opencode plugin add @openchamber/opencode-claude
```

To use this fork from source:

```sh
git clone https://github.com/batteryshark/opencode-claude.git
cd opencode-claude
bun install --frozen-lockfile
bun run build
```

Add the absolute checkout path to `plugins` in your OpenCode configuration:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["/absolute/path/to/opencode-claude"]
}
```

## Quick start

```sh
claude auth login --claudeai
claude auth status
```

Restart OpenCode and select a model under **Claude Code**. Available models come from your CLI/account. OpenCode's tools and permissions remain in use; the proxy binds only to loopback.

## Configuration and commands

- `OPENCODE_CLAUDE_DEBUG=1` enables logging to `~/.local/share/opencode-claude/debug.log`.
- `OPENCODE_CLAUDE_PROXY_PORT` selects a fixed proxy port; the default is a free port.
- `OPENCODE_CLAUDE_CWD` overrides the project directory used by the CLI.
- `bun run build` compiles a source checkout; `bun run test` runs its tests.

See [usage, model behavior, settings and troubleshooting](docs/usage.md) for the full reference and [CHANGELOG.md](CHANGELOG.md) for release changes and contributor attribution.

## License

[MIT](LICENSE). Claude and Claude Code are trademarks of Anthropic.
