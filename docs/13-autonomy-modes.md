# 13 Autonomy Modes

## 目的
確認回数を減らしつつ、事故率も上げすぎないための運用モードを定義する。

## Mode A: Safe default
対象:
- 初回セットアップ
- 依存導入がまだ不安定
- repo をまだ信用しきれない段階

推奨:
- `approval_policy = "on-request"`
- `sandbox_mode = "workspace-write"`
- `network_access = false`

特徴:
- 通常の repo 内編集は進めやすい
- 危険な操作だけ止まりやすい
- 最初はこれでよい

## Mode B: Autonomous worktree
対象:
- trusted project
- setup が済んだ後
- 長めの自律実装
- nightly automation

推奨:
- `approval_policy = "never"`
- `sandbox_mode = "workspace-write"`
- `network_access = false`

特徴:
- 追加承認を待たずに進みやすい
- ただし新しい権限が必要な操作は失敗として返る
- Local より Worktree で使うのが安全

## Mode C: Full-risk manual session
対象:
- 特殊なデバッグ
- 外部接続が必須
- ユーザーが明示的に許可した場合だけ

注意:
- この repo の日常運用では非推奨
- 権限が増えるほど prompt injection や誤操作の面倒が増える

## このプロジェクトでの推奨
- 日常: Mode A
- 夜間継続 / 並列実装: Mode B
- 例外対応のみ: Mode C

## 実務メモ
- 依存導入は setup script 側へ寄せる
- repo 外書込やネットワーク依存を減らすほど自律実装しやすい
- confirmation を減らしたいなら、質問を減らす前に repo 内の既定値を増やす
