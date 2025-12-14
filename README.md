# remorch-connect

AI CLI (Claude Code, Gemini CLI, Codex CLI) をリモートからモニタリング・操作するための接続ツール。

tmuxセッション内でAI CLIを起動し、QRコードで接続情報を表示。外出先からスマホで監視・操作できます。

## Install

```bash
npm install -g remorch-connect
```

Or use directly with npx:

```bash
npx remorch-connect
```

## Quick Start

### 1. Setup aliases (recommended)

```bash
npx remorch-connect --setup
source ~/.zshrc  # or ~/.bashrc
```

This adds aliases: `claude`, `gemini`, `codex`, `remorch`

### 2. Start AI CLI

```bash
claude  # instead of raw 'claude' command
```

This will:
1. Create a tmux session named "claude"
2. Start Claude Code inside it
3. Display QR code for remote connection
4. Attach to the session

## Usage

```bash
# Show connection info only
remorch-connect

# Start CLI in tmux + show QR
remorch-connect claude
remorch-connect gemini
remorch-connect codex

# Start without attaching (background)
remorch-connect claude --no-attach

# Setup shell aliases
remorch-connect --setup

# Help
remorch-connect --help
```

## Features

- **Auto tmux session**: Creates tmux session automatically
- **QR code connection**: Scan with RemOrch app to connect
- **Tailscale detection**: Prefers Tailscale IP for remote access
- **Shell alias setup**: One command to configure `claude`, `gemini`, `codex` aliases
- **Cross-platform**: macOS, Linux, WSL supported

## Output Example

```
┌─────────────────────────────────────────┐
│         RemOrch Connect                 │
│         AI CLI Remote Access            │
└─────────────────────────────────────────┘

Starting: claude
Session:  claude

✓ Created tmux session "claude"
✓ Started "claude"

Connection Info:
  Host:     100.64.183.85
  Port:     22
  User:     yourname
  Session:  claude

  ✓ Tailscale detected: 100.64.183.85

Scan with RemOrch app:

█▀▀▀▀▀█ ▄▄▄▄▄ █▀▀▀▀▀█
█ ███ █ █▄▄▄█ █ ███ █
...

Or enter code: E748-D8D2

Attaching to session...
(Press Ctrl+B, then D to detach)
```

## Requirements

- Node.js 18+
- tmux
- SSH server (for remote access)
- Tailscale (recommended for easy remote access)

## How It Works

```
┌─────────────────┐
│  Your Phone     │
│  (RemOrch App)  │
└────────┬────────┘
         │ SSH (via Tailscale)
         ▼
┌─────────────────┐
│  Your PC / VPS  │
│  ┌───────────┐  │
│  │   tmux    │  │
│  │ ┌───────┐ │  │
│  │ │claude │ │  │
│  │ └───────┘ │  │
│  └───────────┘  │
└─────────────────┘
```

1. `remorch-connect claude` starts Claude Code in a tmux session
2. QR code contains SSH connection info (host, user, port, session)
3. RemOrch app scans QR → SSH connects → attaches to tmux session
4. You can monitor and send commands from your phone

## Supported Shells

| Platform | Shell | Config File |
|----------|-------|-------------|
| macOS | zsh | `~/.zshrc` |
| macOS | bash | `~/.bash_profile` |
| Linux | bash | `~/.bashrc` |
| WSL | bash | `~/.bashrc` |
| Any | fish | `~/.config/fish/config.fish` |

## Related

- [RemOrch](https://github.com/yourname/remorch) - Mobile app for remote AI CLI monitoring
- [RemOrch-webapp](https://github.com/yourname/remorch-webapp) - Web-based PoC

## License

MIT
