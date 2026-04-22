# PROJECT STATUS

最終更新者: Codex  
最終更新日時: 2026-04-22 20:09 JST

## Autonomy Progress
- 完了サイクル数: 39 / 50
- 今回完了したサイクル: DependsOn cycle preview warning

## 現在フェーズ
- Phase 6 in progress. Import preview warning/error filter next

## 直近で完了したもの
- Electron + React + TypeScript + Vite の開発土台作成
- SQL.js ベースの SQLite 永続化、migration、IPC 基盤作成
- Project / Item の最小 CRUD と WBS ツリー画面作成
- WBS コード再計算と親進捗 / 日付ロールアップ実装
- Vitest による domain / DB smoke test 追加
- Quick Capture parser 実装
- Home / Today の最小画面と Inbox / Today / Overdue / 今週マイルストーン表示
- Quick Capture から Inbox または既存 Project へ保存するフロー
- tag / item_tag 永続化と Quick Capture 再発防止テスト追加
- 期限切れタスクの一括延期 API と Home UI 実装
- ACC-003 相当の service test 追加
- Project Detail の WBS grid 列拡張
- item のインデント / アウトデント永続化
- Ctrl+[ / Ctrl+] を使った階層移動ショートカット
- 親子移動と WBS 再採番の service test 追加
- day / week / month timeline の基本表示
- WBS 左ペインと timeline 右ペインの同期スクロール土台
- timeline column / bar layout の domain test 追加
- scheduled task の timeline drag move / right-edge resize 実装
- ACC-006 / ACC-007 相当の timeline interaction test 追加
- detail drawer の追加
- note / tags 編集の永続化と ACC-021 相当の service test 追加
- item field edit 向け undo/redo を追加
- history helper test と ACC-022 対応の keyboard / button 導線を追加
- Electron production build 向け relative asset base を追加
- desktop Playwright smoke で起動と project 作成を自動確認
- Inbox から project assign できる最小編集導線を追加
- ACC-023 相当の service test を追加
- Inbox から日付を1つ追加して 1日タスク化する最小編集導線を追加
- scheduled Inbox item を Home の Today / Overdue 集計へ含めるよう修正
- ACC-024 相当の service test を追加
- Inbox からタグを追加して自動保存する最小編集導線を追加
- Inbox card にタグ表示を追加
- ACC-025 相当の service test を追加
- Portfolio summary query を追加
- progress / overdueCount / next milestone / recentChangeCount7d / riskLevel を返す契約を追加
- ACC-009 相当の service test を追加
- Portfolio table view を追加
- sidebar から Portfolio へ切り替え、project row click で Project Detail へ遷移できるようにした
- desktop Playwright smoke を Portfolio row 確認まで拡張した
- Portfolio project phase query を追加
- root-level group を主要 phase として返す契約を追加
- ACC-010 の service 相当 test を追加
- Portfolio row 左端に expand/collapse を追加
- phase row を project row 直下へ indented row として表示
- desktop Playwright smoke を phase expand 確認まで拡張した
- Year / FY roadmap 用の month bucket domain を追加
- Year と FY の年ラベル解釈を docs と decision に固定した
- ACC-011 / ACC-012 相当の domain test を追加
- sidebar から開ける Year / FY roadmap view を追加
- year / fy toggle と前年 / 次年ナビゲーションを追加
- project row と root-level dated item の month bucket bar / milestone 表示を追加
- desktop Playwright smoke を roadmap month bar 確認まで拡張した
- roadmap quarter header renderer を追加
- Year と FY の両方で `Q1-Q4` header を表示するようにした
- ACC-011 / ACC-012 相当の quarter header domain test を追加
- roadmap に `全件 / 期限超過 / マイルストーン` filter を追加
- overdue filter では条件に合う row がある project row を残すようにした
- desktop Playwright smoke を roadmap filter 確認まで拡張した
- Portfolio に `全案件 / 遅延中 / 今週マイルストーン` filter を追加
- Portfolio filter の空状態と filtered metric 表示を追加
- desktop Playwright smoke を portfolio filter 確認まで拡張した
- Roadmap に root-level group row からの deeper task expansion を追加
- dated descendant と context group を indented row として inline 表示できるようにした
- desktop Playwright smoke を roadmap descendant expand 確認まで拡張した
- dependency table migration と repository を追加
- dependency create/list/delete の service / IPC contract を追加
- 同一 project / 自己参照禁止 / archived 禁止 / 重複 edge 禁止の validation を追加
- ACC-026 相当の service test と DB migration smoke を追加
- dependency create 時の direct / indirect cycle detection を追加
- ACC-015 相当の service test を追加
- item update API に reschedule scope を追加
- timeline move 時の reschedule scope popover を追加
- `with_descendants` で子孫を同一 delta だけ移動する service / browser fallback を追加
- ACC-014 相当の service test を追加
- `with_dependents` で finish-to-start の後続 item とその子孫を最小限だけ後ろへ送る scheduler を追加
- reschedule scope popover の `後続もずらす` を有効化
- ACC-013 相当の service test を追加
- working day utility を追加
- dependency 自動シフトの earliest start を月〜金の営業日基準へ変更
- 金曜終了時に次の月曜へ送られる ACC-013 相当の service test を追加
- Excel workbook の canonical contract module を追加
- `Dashboard -> Tasks -> Gantt_View -> MasterData` の sheet 順序を test で固定
- `Tasks` canonical header order と `DependsOn` serializer を test で固定
- project 単位の backend workbook writer を追加
- minimal OpenXML zip で `.xlsx` bytes を生成できるようにした
- `Dashboard` / `Tasks` / `Gantt_View` / `MasterData` の 4-sheet export を service test と writer test で固定した
- Project Detail toolbar に `Excel Export` を追加
- IPC と OS save dialog 経由で `.xlsx` を保存できるようにした
- desktop Playwright smoke で export button から実ファイルが生成されることを確認した
- Project Detail toolbar に `Excel Import` を追加
- canonical `Tasks` sheet を読む import preview parser と dry-run 集計を追加
- `new / update / error` 件数と preview row 一覧を表示する import preview panel を追加
- desktop Playwright smoke で export 済み workbook を import preview できることを確認した
- import preview panel に `適用` ボタンを追加
- current project 向けの import commit を追加し、`new / update` 行だけを apply できるようにした
- canonical `Tasks` の基本編集列を item へ反映し、`error` 行は skip するようにした
- desktop Playwright smoke で import preview から commit と成功通知まで確認した
- import preview row に field-level issue list を追加
- error row で `列名: 理由` を複数表示できる validation detail を追加
- parser test に複数 validation issue の再発防止ケースを追加
- export 済み workbook を編集して再出力する round-trip fixture helper を追加
- fixture ベースで preview / commit の service 回帰 test を追加
- fixture ベースで invalid edit の preview error 回帰 test を追加
- current project import では `ProjectCode / ProjectName` mismatch を error にする validation を追加
- fixture ベースで project mismatch row の preview error / commit skip を追加
- fixture ベースで `ParentRecordId not found` row の preview error / commit skip を追加
- `DependsOn` の preview validation を追加
- current project 外参照 / 自己参照 / 不明 ID / 不正 token format を error にするようにした
- parser test と fixture-based service test で `DependsOn` validation を固定した
- `DependsOn` の import commit を追加
- current project の既知 predecessor を successor 単位で置き換えて保存するようにした
- fixture-based service test で dependency 置換と新規 row への dependency 追加を固定した
- import preview row に warnings を追加
- workbook の `LastModifiedAt` が既存 item の `updatedAt` より古い update row に warning を表示するようにした
- parser test と fixture-based service test で stale workbook warning を固定した
- current project の existing dependency graph を import preview へ渡すようにした
- `DependsOn` が import 後 graph に cycle を作る update row へ warning を表示するようにした
- parser test と fixture-based service test で cycle warning を固定した

## 今いちばん重要な次アクション
1. import preview に warning / error filter を追加する
2. detail drawer に dependency 編集 UI を追加する
3. timeline drag の keyboard / accessibility 補助を追加する
4. `DependsOn` の new row 同士の dependency import 解決を追加する

## 現在の blocker
- なし

## 既知のリスク
- 現在の DB は SQL.js を同期 API として使っており、大量件数では書込コスト評価が未実施
- desktop E2E は最小 smoke 1 本のみで、現状の自動確認は lint / typecheck / unit / build / desktop smoke まで
- roadmap view は deeper task expansion までで、row virtualization は未着手
- Quick Capture の recurrence / project 名一般解釈は最小実装で、複雑な自然文は未対応
- WBS の並び替えはインデント / アウトデントまでで、drag reorder は未着手
- timeline drag edit は scheduled item のみ対応で、dependency 連動は未接続
- detail drawer の dependency UI / recurrence / history は未着手で、dependency 編集 UI は Phase 5 の後続 slice で着手予定
- undo/redo は create / archive / hierarchy move をまだ対象にしていない
- 年間ビューは行数増加時に virtualized timeline が必要
- Excel round-trip は列契約を先に固定しないと後戻りコストが高い
- 依存関係の自動シフトは working day と組み合わさるため、適用順の固定が必要
- 現在の reschedule scope popup は timeline move 経路のみで、date input 直接編集にはまだ出ない
- dependency shift は月〜金の既定営業日に対応したが、カスタム稼働日設定と predecessor 前倒しにはまだ未対応
- recentChangeCount7d は現状 item.updatedAt ベースで、同一 project の rollup 再計算に引っ張られて粗めに増える
- workbook writer は minimal OpenXML / store-only ZIP で、書式・列幅・印刷最適化は未実装
- browser fallback の export は download 開始までで、Electron のような保存先パス通知は返さない
- import preview / commit は initial slice で、`.xlsx` canonical `Tasks` sheet と基本編集列まで。rollback は未実装
- browser fallback の import preview は未対応
- import commit は current project と canonical `Tasks` の基本編集列に限定しており、dependency import / rollback / project 横断 apply は未実装
- import error 表示は field-level issue list までで、独立した validation table や修正 UI は未実装
- round-trip fixture は `Tasks` canonical sheet を中心にした test helper で、Dashboard / Gantt_View / MasterData の表示 fidelity までは固定していない
- `DependsOn` commit は current project の既知 predecessor に限定しており、new row 同士の dependency 解決は未実装
- import preview の warning は row 内表示までで、warning/error filter と dedicated 集約表示は未実装

## 次に見るべきドキュメント
- `docs/08-implementation-plan.md`
- `docs/09-acceptance-tests.md`
- `docs/backlog.yaml`

## セッション終了時の更新テンプレート

### このセッションでやったこと
- Phase 0 と Phase 1 をまとめて着手し、起動可能な desktop shell を作成
- SQLite 永続化、IPC、Project/Item CRUD、WBS 表示を実装
- domain / DB の最小テストを追加し、各チェックを実行
- Quick Capture parser、Home / Today 画面、Inbox 保存フローを追加
- tag / item_tag migration と Quick Capture service test を追加
- overdue 一括延期の service / UI / browser fallback を追加
- ACC-003 相当の自動テストを追加
- WBS grid に優先度 / 担当 / 日付 / タグ列を追加
- item 階層移動 API と UI 操作を追加
- hierarchy move の自動テストを追加
- timeline domain と split-pane UI を追加
- day / week / month 切替と同期スクロール土台を追加
- timeline domain test を追加

### 変更したファイル
- `package.json`, `tsconfig*.json`, `vite.config.ts`, `eslint.config.js`
- `src/main/*`, `src/preload/*`, `src/renderer/*`, `src/domain/*`, `src/infra/db/*`
- `docs/backlog.yaml`, `docs/decisions.yaml`, `PROJECT_STATUS.md`

### 実行した確認
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- Electron launch smoke と DB 生成確認
- Electron launch smoke 再確認
- overdue 一括延期テストを追加して再確認
- hierarchy move テストを追加して再確認
- timeline test を追加して再確認
- drag move / resize の timeline interaction test を追加して再確認
- detail drawer の note / tags 永続化テストを追加して再確認
- undo/redo helper test を追加して再確認
- desktop Playwright smoke を追加して再確認
- Inbox project assign の service / UI を追加して再確認
- Inbox date add の service / UI を追加して再確認
- desktop Playwright smoke を再実行して再確認
- Inbox tag add の service / UI を追加して再確認
- desktop Playwright smoke を再実行して再確認
- Portfolio summary query の service / IPC / fallback を追加して再確認
- Portfolio table view の renderer / store / e2e を追加して再確認
- Portfolio phase expand query の service / IPC / fallback を追加して再確認
- Portfolio phase expand UI の renderer / e2e を追加して再確認
- Year / FY roadmap month bucket domain と test を追加して再確認
- Year / FY roadmap renderer foundation と e2e を追加して再確認
- roadmap quarter header renderer と test を追加して再確認
- roadmap filters と e2e を追加して再確認
- portfolio filters と desktop smoke を追加して再確認
- roadmap deeper task expansion と desktop smoke を追加して再確認
- dependency table / validation の service test と DB migration smoke を追加して再確認
- dependency cycle detection の service test を追加して再確認
- reschedule scope popup と descendants shift の service test / desktop smoke を追加して再確認
- dependent shift の service test / desktop smoke を追加して再確認
- working day utility と営業日境界の service test を追加して再確認
- Excel import preview parser / service / UI / desktop smoke を追加して再確認
- Excel import commit の service / UI / desktop smoke を追加して再確認
- Excel import validation detail の parser / UI / parser test を追加して再確認
- Excel round-trip fixture helper と fixture-based service test を追加して再確認

### 結果
- [x] 成功
- [ ] 一部成功
- [ ] Blocked

### 次にやるべき最小単位
- import preview に warning / error filter を追加する

### 残リスク
- desktop E2E 未整備
- SQL.js 永続化の性能評価未了
- custom working day 設定は未着手
- drag reorder 未着手
