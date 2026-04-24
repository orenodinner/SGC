# 11 Codex Operations

## 11.1 目的
このリポジトリを Codex app / CLI で長期間運用しやすくするための実務手順を定義する。

## 11.2 推奨の基本運用

### 初回
1. Git リポジトリ化する
2. この実装パックを root に置く
3. Codex app で project として開く
4. Project を trusted 扱いで使う
5. `AGENTS.md` を読ませてから最初の thread を始める

### 通常の実装
- 小さめの作業: Local thread
- 並行作業や長時間作業: Worktree thread
- 定例確認: Automation

## 11.3 Worktree 利用ルール
- 大きい機能は Worktree で行う
- 1 Worktree = 1 slice を原則とする
- merge 前に review pane で差分確認
- Local に handoff するのは、最終確認やローカルアプリ実行が必要なとき

## 11.4 Local Environment 推奨
プロジェクトの setup script と action は Codex app の local environment から設定する。  
この repo では `scripts/` 以下を呼ぶ前提でよい。

### Windows setup script 推奨
- `powershell -ExecutionPolicy Bypass -File scripts/setup-worktree.ps1`

### Actions 推奨
- Dev: `powershell -ExecutionPolicy Bypass -File scripts/dev.ps1`
- Test: `powershell -ExecutionPolicy Bypass -File scripts/test.ps1`
- Build: `powershell -ExecutionPolicy Bypass -File scripts/build.ps1`

`build.ps1` の初期 installer slice は Windows 向け portable artifact を生成する。  
出力先は `artifacts/` 配下で、version 付き staging folder と `.zip` を残す。  
生成物には bundled Electron runtime、`dist/`、`dist-electron/`、必要最小限の runtime `node_modules/`、`Launch SGC.cmd` を含める。
`TASK-1204` 以降は `spec/portable-artifact-contract.json` を portable artifact の契約として扱い、build script は required path を検証してから `.zip` を生成する。

### Windows 配布 / 更新方針
- 現時点の配布 channel は `portable_zip` とする
- 更新は新しい zip を別フォルダへ展開し、`Launch SGC.cmd` から起動する `manual_replace` とする
- rollback は前回展開済みフォルダを残しておき、そこから再起動する方式とする
- MSI、auto updater、code signing、store distribution は証明書 / 公開ポリシー / 外部契約が必要なため、この implementation pack の完了条件からは外す
- artifact 内には `DISTRIBUTION.txt` と `build-manifest.json` を同梱し、起動・更新・rollback 方針をユーザーが確認できるようにする

## 11.5 レビュー運用
- 変更後は review pane で差分確認
- 問題があれば inline comment を残し、その後 thread に「inline comments を解消して scope を最小に」と投げる
- 大きな差分は `/review` を併用する

## 11.6 Automation 推奨
- Nightly backlog continuation
- Weekly spec drift review
- Weekly release-note draft（後半フェーズ）

推奨 prompt は `prompts/automation-*.md` を使う。

## 11.7 Codex への依頼の仕方
### 良い依頼
- 仕様ソースを明示する
- 完了条件を明示する
- 確認質問を減らしたいことを明示する
- テストと状態更新まで要求する

### 悪い依頼
- 「適当にいい感じに」
- 「とりあえず UI 作って」
- 「細かい仕様は後で考える」

## 11.8 非対話実行の考え方
CI やバッチ確認では `codex exec` 相当の非対話実行を使う設計が向く。  
ただし、この repo ではまず interactive / app 運用を主とし、安定した作業だけ automation 化する。

## 11.9 推奨スレッド種別
- Kickoff thread
- Feature slice thread
- Bugfix / stabilization thread
- Review resolution thread
- Spec drift thread
- Release candidate thread

## 11.10 セッション終了時の必須出力
- 何を変えたか
- どのテストを通したか
- 何が未完か
- 次にどこから再開すべきか
- `PROJECT_STATUS.md` 更新
