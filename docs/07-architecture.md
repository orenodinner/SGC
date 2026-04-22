# 07 Architecture

## 7.1 採用スタック

- Desktop shell: Electron
- Frontend: React + TypeScript + Vite
- State: Zustand
- Data: SQLite
- DB access: better-sqlite3 もしくは同等の同期API
- Validation: Zod
- Dates: date-fns 系ユーティリティ
- Excel: SheetJS (`xlsx`)
- Unit test: Vitest
- E2E: Playwright
- Packaging: electron-builder 相当

## 7.2 このスタックを選ぶ理由
- Windows デスクトップ配布がしやすい
- Excel I/O 実装がしやすい
- ローカル DB と相性がよい
- Codex が継続実装しやすい構造を作りやすい
- テスト・ビルド・配布まで Node 中心で閉じやすい

## 7.3 レイヤ構成

```text
src/
  main/                 Electron main process
  preload/              IPC bridge
  renderer/             React UI
  shared/               型・DTO・定数
  domain/               ルール・スケジューラ・ロールアップ
  infra/
    db/                 SQLite, migration, repository
    excel/              import/export
    backup/             backup
  features/
    home/
    inbox/
    project-detail/
    portfolio/
    roadmap/
    settings/
  test/
```

## 7.4 プロセス境界

### Main process
- DB 接続
- ファイル I/O
- Excel import/export
- バックアップ
- OS 統合

### Preload
- 安全な IPC 公開
- renderer に必要最小限 API のみ渡す

### Renderer
- 画面描画
- 一時編集状態
- ルーティング
- UI イベント

## 7.5 IPC 契約（概略）
- `project:list`
- `project:get`
- `project:save`
- `item:listByProject`
- `item:upsert`
- `item:move`
- `item:bulkReschedule`
- `dependency:listByProject`
- `dependency:create`
- `dependency:delete`
- `portfolio:summary`
- `roadmap:range`
- `excel:export`
- `excel:importPreview`
- `excel:importCommit`
- `settings:get`
- `settings:set`

## 7.6 Timeline rendering 方針
- WBS 左ペインと timeline 右ペインを同期スクロール
- 行数が多いので virtual list を前提
- 年間表示は 1日単位レンダリングを避け、月 / 四半期の bucket 表示へ圧縮
- dependency line は必要表示範囲だけを描画

## 7.7 Scheduler 方針
- task 更新時に親ロールアップ
- dependency がある場合は forward scheduling
- working day を考慮
- re-schedule scope に応じて影響範囲を制御
- 循環依存検知を必須

## 7.8 バックアップ方針
- 起動時に最新DB健全性チェック
- 1日1回自動スナップショット
- export 実行前にもスナップショット可能
- バックアップ保持数は設定可能（初期 14）

## 7.9 ログ方針
- 開発時: console + file log
- 本番時: rotating log file
- 個人情報や秘匿情報は書かない

## 7.10 セキュリティ方針
- preload 経由の最小公開
- `contextIsolation: true`
- `nodeIntegration: false`
- 任意パス読取はユーザー操作経由に限定
- import ファイルは schema validation 後に反映

## 7.11 テスト方針
- `domain/` はユニットテスト重視
- `infra/excel/` は round-trip fixture テスト
- `features/` は主要フロー E2E
- DB マイグレーションは空DBからの smoke test を用意

## 7.12 推奨開発順
1. shell / DB / migration
2. item CRUD
3. quick capture
4. project detail + WBS
5. basic timeline
6. portfolio summary
7. year/FY roadmap
8. excel round-trip
9. hardening
