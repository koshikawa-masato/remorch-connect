# remorch-connect

AI CLI（Claude Code, Gemini CLI, Codex CLI）をリモートからモニタリング・操作するための接続ツール。

tmuxセッション内でAI CLIを起動し、QRコードで接続情報を表示。外出先からスマホで監視・操作できます。

## インストール

```bash
npm install -g remorch-connect
```

npxで直接実行も可能：

```bash
npx remorch-connect
```

## クイックスタート

### 1. エイリアス設定（推奨）

```bash
npx remorch-connect --setup
source ~/.zshrc  # または ~/.bashrc
```

`claude`, `gemini`, `codex`, `remorch` エイリアスが追加されます。

### 2. AI CLIを起動

```bash
claude  # 通常の claude コマンドの代わりに
```

実行すると：
1. "claude" という名前のtmuxセッションを作成
2. その中でClaude Codeを起動
3. リモート接続用のQRコードを表示
4. セッションにアタッチ

## 使い方

```bash
# 接続情報のみ表示
remorch-connect

# tmuxでCLIを起動 + QR表示
remorch-connect claude
remorch-connect gemini
remorch-connect codex

# バックグラウンドで起動（アタッチしない）
remorch-connect claude --no-attach

# シェルエイリアスを設定
remorch-connect --setup

# ヘルプ
remorch-connect --help
```

## 機能

- **tmux自動セッション**: tmuxセッションを自動作成
- **QRコード接続**: RemOrchアプリでスキャンして接続（`remorch://`スキーム対応）
- **Tailscale検出**: TailscaleのIPを自動検出・優先使用
- **シェルエイリアス設定**: `claude`, `gemini`, `codex` を一発で設定
- **クロスプラットフォーム**: macOS, Linux, WSL対応

## 出力例

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

  ✓ QR code opened: /tmp/remorch-qr-claude.png

Or enter code: E748-D8D2

Or open on your phone:
  https://koshikawa-masato.github.io/remorch-web/#eyJ2IjoxLC...

Attaching to session...
(Press Ctrl+B, then D to detach)
```

## 必要環境

- Node.js 18以上
- tmux
- SSHサーバー（リモートアクセス用）
- Tailscale（推奨・簡単にリモートアクセス可能）

## 仕組み

```
┌─────────────────┐
│  スマートフォン   │
│  (RemOrch App)  │
└────────┬────────┘
         │ SSH (Tailscale経由)
         ▼
┌─────────────────┐
│  PC / VPS       │
│  ┌───────────┐  │
│  │   tmux    │  │
│  │ ┌───────┐ │  │
│  │ │claude │ │  │
│  │ └───────┘ │  │
│  └───────────┘  │
└─────────────────┘
```

1. `remorch-connect claude` でClaude Codeをtmuxセッション内で起動
2. QRコードにSSH接続情報を含む（ホスト, ユーザー, ポート, セッション名）
3. RemOrchアプリでQRスキャン → SSH接続 → tmuxセッションにアタッチ
4. スマホからモニタリング・コマンド送信

## 対応シェル

| プラットフォーム | シェル | 設定ファイル |
|-----------------|--------|-------------|
| macOS | zsh | `~/.zshrc` |
| macOS | bash | `~/.bash_profile` |
| Linux | bash | `~/.bashrc` |
| WSL | bash | `~/.bashrc` |
| 全OS | fish | `~/.config/fish/config.fish` |

## 関連

- [remorch-web](https://github.com/koshikawa-masato/remorch-web) - QRコード表示用Webページ

## ライセンス

MIT
