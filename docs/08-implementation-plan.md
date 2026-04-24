# 08 Implementation Plan

## フェーズ原則
- 各フェーズは単独で価値がある状態まで持っていく
- 仕様だけ増やして未完成を溜めない
- 毎フェーズ終了時に受け入れ試験を更新する

## Phase 0: Repository bootstrap
### 目的
実装の土台を作る

### 作業
- Electron + React + TS + Vite 初期化
- lint / format / test / build 導入
- DB migration 基盤
- IPC 基盤
- PROJECT_STATUS 更新フロー確立

### 完了条件
- アプリ起動
- 空画面表示
- テストコマンドが通る
- SQLite 初期DB生成

## Phase 1: Domain core
### 目的
Project / Item / WBS の骨格を作る

### 作業
- project/item repository
- WBS tree CRUD
- sort order
- WBS code 再計算
- status/priority enum
- basic settings

### 完了条件
- 1プロジェクト内で親子タスク CRUD 可
- 再起動後も保持
- WBS の並びと階層が崩れない

## Phase 2: Quick Capture + Home
### 目的
最初の価値を出す

### 作業
- Quick Capture parser
- Inbox
- Today / Overdue
- auto-save
- quick postpone

### 完了条件
- 1行入力で task 作成
- 未計画は Inbox
- 期限切れの一括延期可

## Phase 3: Project Detail + Basic Gantt
### 目的
本丸の編集体験を成立させる

### 作業
- WBS grid
- timeline day/week/month
- bar drag/resize
- detail drawer
- parent rollup
- undo/redo

### 完了条件
- Project Detail で日程編集ができる
- 親子のロールアップが効く
- undo/redo 可

## Phase 4: Portfolio + Year/FY Roadmap
### 目的
複数大規模案件と長期視点を成立させる

### 作業
- portfolio summary query
- project risk calculation
- expand/collapse on portfolio
- year/fy month bucket timeline
- quarter headers
- roadmap filters

### 完了条件
- 複数 project 横断で次マイルストーンが見える
- 年間 / FY 表示が可能
- フェーズ展開が可能

## Phase 5: Dependency + Rescheduling logic
### 目的
実務レベルの調整体験を成立させる

### 作業
- dependency model
- cycle detection
- reschedule scope
- dependent shift
- working day logic

### 完了条件
- FS dependency が使える
- 循環依存を防げる
- 子孫 / 後続連動が動く

## Phase 6: Excel Round-trip
### 目的
現場接続を成立させる

### 作業
- export workbook 生成
- import preview
- validation table
- import commit
- fixtures
- round-trip test

### 完了条件
- canonical sheet round-trip 成立
- dry-run あり
- 主要列の欠損なし

## Phase 7: Templates + Recurrence
### 目的
ズボラ向け省力化を強化

### 作業
- recurring rules
- project template
- WBS template
- template apply flow

### 完了条件
- 週次 / 月次生成
- ひな形から project 作成

## Phase 8: Hardening
### 目的
使い切れる品質にする

### 作業
- backup
- recovery
- performance tuning
- accessibility pass
- installer
- docs cleanup

### 完了条件
- P0/P1 受け入れ試験 pass
- build artifact 生成
- known issues 文書化

## Phase 9: Core spec parity
### 目的
一次仕様に明記されているが backlog から漏れていた主経路ギャップを閉じる

### 作業
- Project Detail の drag reorder
- Project Detail の最小コンテキストメニュー
- Search / Filter Drawer

### 完了条件
- WBS row を drag reorder できる
- row ごとの最小コンテキストメニューが使える
- drawer から current view の絞り込みができる

## Phase 10: Settings parity
### 目的
設定系の仕様を user-facing に閉じる

### 作業
- Settings 画面の追加
- 表示言語 / 週開始曜日 / FY開始月 / 稼働日 / テーマ / 既定表示の保存
- 自動バックアップ設定 / Excel テンプレート既定値の入力導線

### 完了条件
- settings 画面から主要設定を編集できる
- 再起動後も設定が保持される
- FY / working day / default view が実動作に反映される

## Phase 11: Template and recurrence UI parity
### 目的
既にある template / recurrence service を user-facing workflow に接続する

### 作業
- Inbox のテンプレート変換
- WBS / project template の save / list / apply UI
- detail drawer の recurrence editor

### 完了条件
- template を UI から保存 / 適用できる
- Inbox から template conversion を起動できる
- recurrence rule を UI から追加 / 更新 / 削除できる

## Phase 12: Multilingual UI parity and deferred polish
### 目的
日本語を含む多言語 UI を major heading だけでなく実運用で触る overlay / drawer / utility 面まで広げ、backlog 完了後に残った deferred scope を追跡可能な形へ戻す

### 作業
- stale tracker wording cleanup
- overlay / drawer / import preview / recovery / utility copy の i18n parity
- generic recurrence editor や fuller theme / installer / compare hardening の再 backlog 化

### 完了条件
- docs 上で deferred scope が Phase 12 として追跡できる
- `ja / en` 切替で主要 overlay / drawer / import preview copy が切り替わる
- stale な `次アクション` や完了済み機能の未着手表現が状態ファイルから消えている

## 優先順位
- P0: Phase 0〜4, Phase 9
- P1: Phase 5〜6, Phase 10
- P2: Phase 7〜8, Phase 11〜12

## 1スライスの推奨サイズ
- 0.5〜2日で完了するサイズ
- UI / domain / test を縦切りで持つ
- 1PR / 1thread でレビューしきれる差分量

## セッションの締め方
- 受け入れ条件を満たしたか確認
- 未完なら next slice を `PROJECT_STATUS.md` へ明記
- 中途半端な TODO をコード中に残しすぎない
