# Codex 実装パック: Windows向け超簡単ガントチャート / タスク管理アプリ

このフォルダは、**Codex app で長期間・自律的に実装を継続しやすくするためのテキストベース実装パック**です。  
目的は、ユーザー確認の頻度を極力下げながら、仕様ブレ・実装ブレ・レビュー漏れを減らすことです。

## このパックでできること

- 仕様の一次ソースを `docs/` に固定
- Codex の恒久指示を `AGENTS.md` に集約
- プロジェクト既定動作を `.codex/config.toml` に定義
- 長期実装用のプロンプトを `prompts/` に整理
- 再利用可能なスキルを `.agents/skills/` に配置
- 進捗継続用の状態ファイルを `PROJECT_STATUS.md` に用意
- PowerShell ベースの作業スクリプトを `scripts/` に準備
- 受け入れ試験を `docs/09-acceptance-tests.md` と `spec/acceptance_tests.yaml` に二重化

## 想定プロダクト

Windows向けデスクトップアプリ。  
「入力が雑でも使える」「日程変更がドラッグで終わる」「大きな案件を複数横断できる」「内訳を展開できる」「年次/FYで長期閲覧できる」「Excelに逃がせる」を中核価値にします。

## 推奨の使い方

1. Git リポジトリを用意する
2. このパックをリポジトリ直下へ配置する
3. Codex app でそのリポジトリを開く
4. まず `AGENTS.md` と `docs/11-codex-operations.md` を読ませる
5. `prompts/00-kickoff.md` を最初のスレッドで使う
6. 実装継続時は `prompts/02-continue-from-current-state.md` を使う
7. 大きい作業は Worktree で分ける
8. 安定化は `prompts/04-bugfix-and-stabilization.md` を使う
9. 定例チェックは automation 用プロンプトを使う

## 主要ファイル一覧

- `AGENTS.md`  
  Codex に毎回読ませる最重要ファイル
- `PROJECT_STATUS.md`  
  現在地。エージェントが毎回更新する前提
- `docs/02-product-requirements.md`  
  プロダクト要求
- `docs/03-functional-spec.md`  
  機能仕様
- `docs/04-ux-spec.md`  
  UI/UX 詳細
- `docs/05-data-model-and-db.md`  
  データモデル / SQLite スキーマ
- `docs/06-excel-roundtrip-contract.md`  
  Excel 入出力契約
- `docs/07-architecture.md`  
  実装アーキテクチャ
- `docs/08-implementation-plan.md`  
  実装フェーズ
- `docs/09-acceptance-tests.md`  
  受け入れ試験
- `docs/10-agent-autonomy-policy.md`  
  質問を減らす判断ルール
- `.codex/config.toml`  
  Codex の推奨プロジェクト設定
- `.agents/skills/`  
  実装継続、レビュー、安定化のスキル
- `prompts/`  
  貼り付けるだけで使えるプロンプト群

## 実装スタックの前提

本パックでは、**Electron + React + TypeScript + Vite + SQLite + SheetJS + Vitest + Playwright** を前提にしています。  
理由は、Windows デスクトップ実装、Excel 対応、ローカルファースト、Codex による継続実装のしやすさのバランスが最もよいからです。

## 重要な運用ルール

- 仕様の一次ソースは `docs/`。口頭判断で仕様を書き換えない
- 不明点はまず `docs/10-agent-autonomy-policy.md` の既定値で解決する
- 実装後は必ずテスト・自己レビュー・状態更新まで行う
- ユーザー確認は、本当に不可逆か高リスクな場合に限る
- 途中で迷ったら `PROJECT_STATUS.md` と `docs/backlog.yaml` を更新してから次に進む

## 最初に貼るとよい一文

`AGENTS.md と docs/ を唯一の仕様として読んだうえで、prompts/00-kickoff.md の方針に従って自律実装を開始して下さい。`
