# 14 Autonomous Completion Plan

最終更新: 2026-04-25

## 目的

Codex がユーザー確認を最小化したまま、SGC を「毎日使える軽量な実用品」として完走させるための実行順と検証ゲートを固定する。

この文書は `PROJECT_STATUS.md` / `docs/backlog.yaml` / `docs/08-implementation-plan.md` を補助する実行計画であり、仕様の変更が必要な場合は該当する一次仕様を先に更新してから実装する。

## 現在の完成ライン

- P0 / P1 / Phase 0-11 は backlog 上完了扱い。
- Phase 12 は deferred polish の回収フェーズとして残す。
- 完走判定は `EPIC-12` の全 task が `done` になり、validation bundle が通ること。
- portable zip は生成済みだが、portable zip 以外の配布 / 更新方針は `TASK-1204` で閉じる。

## 自律実装順

### 1. `TASK-1202` Generic Recurrence Editor

目的: preset 以外の cadence を UI から構築できるようにし、unsupported rule を raw text の read-only 表示から user-facing rebuild flow へ進める。

実装方針:
- 既存の recurrence persistence と generation support を壊さない。
- generation できない rule は作れるだけにせず、UI 上で「保存可 / 自動生成対象外」を明示する。
- まず scheduled task の detail drawer 内に留め、別 modal は作らない。
- raw `rrule_text` の直接編集は fallback とし、通常操作は field builder を優先する。

検証:
- recurrence domain test を追加または更新する。
- workspace service test で persistence / unsupported handling / delete を固定する。
- desktop Playwright smoke で unsupported rule の rebuild flow を固定する。

### 2. `TASK-1203` Theme Token Coverage

目的: dark mode の破綻が残りやすい chart / status / import / roadmap / portfolio surface を token 化する。

実装方針:
- 色だけの大改修にしない。実際に暗色で読みにくい surface を優先する。
- status color は semantic token として定義し、light/dark の両方で contrast を確保する。
- roadmap / timeline / import preview の既存 layout は変えず、CSS variable 化を中心にする。

検証:
- CSS token の regression は Playwright smoke で dark theme の主要 surface を確認する。
- unit test が不要な CSS-only 差分でも、少なくとも `typecheck` / `lint` / `build` は通す。

### 3. `TASK-1204` Installer And Regression Hardening

目的: portable zip の次に必要な配布 / 更新方針を tracker 上で閉じ、desktop E2E を smoke より広げる。

実装方針:
- 外部 SaaS、署名証明書、ストア配布は blocker 扱いにしない。必要なら docs に「未契約のため対象外」と記録する。
- まず現実的な Windows local distribution として portable zip の運用手順、更新手順、rollback 手順を明文化する。
- installer pipeline を追加する場合は、既存 `scripts/build.ps1` と artifact layout を壊さない。

検証:
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- 変更範囲に応じて `npm run test:e2e`

## セッション開始手順

1. `PROJECT_STATUS.md` を読む。
2. `docs/backlog.yaml` の最初の `pending` または `in_progress` task を選ぶ。
3. 対応する仕様を `docs/03-functional-spec.md`、UX を `docs/04-ux-spec.md`、受け入れ試験を `docs/09-acceptance-tests.md` から確認する。
4. 関連コードと既存 test を読む。
5. UI / service / fallback / test / docs を同じ slice で閉じる。
6. `PROJECT_STATUS.md` と必要なら `docs/backlog.yaml` / `docs/decisions.yaml` を更新する。

## 停止条件

次のいずれか以外ではユーザー確認を求めない。

- 認証情報、署名証明書、外部 SaaS 契約が必要。
- 既存ユーザーデータを不可逆に移行または削除する必要がある。
- docs 同士が矛盾し、`docs/10-agent-autonomy-policy.md` の既定値でも解決できない。
- Windows / Electron / Playwright の実行環境が壊れており、repo 内で安全に検証できない。

## 完走時の最終ゲート

- `docs/backlog.yaml` の全 task が `done`。
- `PROJECT_STATUS.md` に完走日、残リスク、配布物、検証コマンドを記録済み。
- `npm run typecheck` / `npm run lint` / `npm run test` / `npm run build` が通る。
- desktop E2E の代表シナリオが通るか、環境 blocker が具体的に記録されている。
- `artifacts/` にユーザーが起動できる配布物または明確な作成手順がある。
