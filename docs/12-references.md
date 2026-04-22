# 12 References

このパックは、以下の Codex 公式ドキュメントに整合する形で構成している。

- Codex app overview
- Codex app features
- AGENTS.md
- Best practices
- Config basics
- Config reference
- Sample config
- Agent approvals & security
- Worktrees
- Automations
- Local environments
- Review
- Non-interactive mode
- Skills
- Codex Prompting Guide

## 構成への反映点

### AGENTS.md
Codex は作業前に `AGENTS.md` を読む前提なので、repo root に配置している。

### .codex/config.toml
Codex の project-scoped config を repo に持ち、trusted project で読み込ませる想定。

### Worktrees
長時間並列作業は Worktree 前提で設計。Local を汚しにくくする。

### Automations
安定した反復作業は automation prompt に切り出している。

### Local environments
worktree 作成時の setup 手順を `scripts/` として repo 管理し、app 側から呼ぶ想定。

### Review
Git repository 前提で review pane を活用できるよう、状態更新とテストを毎回要求している。

### Skills
再開・安定化・スライス実装の3種類を skill 化している。
