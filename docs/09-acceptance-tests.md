# 09 Acceptance Tests

## P0

### ACC-001 Quick Capture basic
**Given** アプリ初期状態  
**When** `見積提出 4/25 #営業 @自分` を入力  
**Then**
- タスクが作成される
- タイトルは `見積提出`
- 日付は 4/25
- タグ `営業` が付く
- 担当 `自分` が付く

### ACC-002 Unscheduled inbox
**Given** `アイデア整理` を入力  
**When** 日付なしで保存  
**Then**
- Inbox に入る
- scheduled=false になる

### ACC-003 Overdue postpone
**Given** 期限切れタスクが3件ある  
**When** 一括で「今日へ」を実行  
**Then**
- 3件の終了日が今日に移動
- 自動保存される

### ACC-004 WBS hierarchy
**Given** プロジェクト詳細画面  
**When** 親・子・孫を作成  
**Then**
- 階層が保持される
- WBSコードが順に付く
- 折りたたみで子孫が隠れる

### ACC-005 Parent roll-up
**Given** 2つの子タスクが 50% と 100%  
**When** 親を表示  
**Then**
- 親進捗が重み付き平均で計算される

### ACC-006 Drag move task
**Given** 5日タスク  
**When** ガントバー中央を2日右へドラッグ  
**Then**
- 開始日と終了日が2日ずつ移動する
- 期間長は変わらない

### ACC-007 Drag resize task
**Given** 5日タスク  
**When** 右端を3日伸ばす  
**Then**
- 終了日だけが伸びる
- duration_days が更新される

### ACC-008 Project persistence
**Given** プロジェクトとタスクを作成済み  
**When** アプリを再起動  
**Then**
- データが保持される

### ACC-021 Detail drawer note and tags
**Given** Project Detail でタスクを選択済み  
**When** Detail drawer で note と tags を編集  
**Then**
- note が保存される
- tags が保存される
- WBS grid のタグ表示にも反映される

### ACC-022 Undo redo item edit
**Given** Project Detail で item のタイトルまたは日付を編集済み  
**When** undo を実行してから redo を実行  
**Then**
- undo で直前の item 編集が元に戻る
- redo で同じ編集が再適用される
- create / archive / hierarchy move はこの undo 対象に含めない

### ACC-023 Inbox project assign
**Given** Inbox に未計画タスクが1件あり、割当先 project が存在する  
**When** Inbox から project を割り当てる  
**Then**
- item の project が更新される
- Inbox からその item が消える
- 割当先 project detail にその item が現れる

### ACC-024 Inbox date add
**Given** Inbox に未計画タスクが1件ある  
**When** Inbox から日付を1つ追加する  
**Then**
- item の `startDate` と `endDate` に同日が入る
- `scheduled=true` になる
- Inbox からその item が消える
- 当日を指定した場合は Today に現れる

### ACC-025 Inbox tag add
**Given** Inbox に未計画タスクが1件ある  
**When** Inbox からタグを追加する  
**Then**
- item の tags が更新される
- 重複タグは保存時に正規化される
- item は Inbox に残る
- Inbox card のタグ表示に反映される

### ACC-009 Portfolio summary
**Given** 3プロジェクトが存在  
**When** Portfolio view を開く  
**Then**
- 各プロジェクトの進捗 / 期限超過数 / 次マイルストーンが見える
- 直近7日変更数と riskLevel が project ごとに算出される
- `遅延中` filter で `overdueCount >= 1` の project だけへ絞り込める
- `今週マイルストーン` filter で `nextMilestoneDate` が今週内の project だけへ絞り込める

### ACC-010 Portfolio expand
**Given** プロジェクトに phase group がある  
**When** Project row 左端の expand を押す  
**Then**
- 主要 phase 行が見える
- phase 行は project row の直下に indented row として出る
- root-level `group` が sort_order 順で並ぶ

### ACC-011 Year roadmap
**Given** 複数月にまたがるタスクが存在  
**When** Year view を開く  
**Then**
- 選択年の 1月-12月 bucket が使われる
- 暦年基準の `Q1-Q4` header が見える
- `期限超過` filter で条件に合う row だけへ絞り込める
- root-level `group` row を展開すると dated descendant が indented row として見える
- 月単位のバーで見える
- マイルストーンは菱形で見える

### ACC-012 FY roadmap
**Given** FY開始月=4  
**When** FY view を開く  
**Then**
- 4月始まりのヘッダになる
- `FY2026` は `2026-04` から `2027-03` の bucket を使う
- FY基準の `Q1-Q4` header が見える
- `マイルストーン` filter で milestone row を絞り込める

## P1

### ACC-013 Finish-to-start dependency
**Given** A -> B の依存  
**When** A を3日後ろへずらす  
**Then**
- B も必要に応じて後ろへずれる
- B が移動した差分は B の子孫にも適用される
- A の終了が金曜になった場合、B の開始は次の月曜以降になる

### ACC-014 Reschedule scope descendants
**Given** 親と子タスク  
**When** 親のバーを移動し `with_descendants` を選択  
**Then**
- 子孫も同じ差分だけ移動する

### ACC-015 Dependency cycle prevented
**Given** A -> B と B -> C が存在  
**When** B -> A または C -> A を作ろうとする  
**Then**
- 保存できずエラー表示

### ACC-026 Dependency create validation
**Given** 同一 project に A と B があり、両方とも archived ではない  
**When** `finish_to_start` dependency を A -> B で作成  
**Then**
- dependency record が保存される
- `lagDays` が保持される
- 同一 edge の重複登録は保存できない
- A -> A の自己参照は保存できない

### ACC-027 Detail drawer dependency editor
**Given** Project Detail に A と B があり、B を selected item にしている  
**When** Detail drawer から A を先行タスクとして追加し、その後 dependency を削除する  
**Then**
- B の dependency 一覧に `A -> B` が見える
- `lagDays` が表示される
- 削除後は dependency 一覧から消える
- browser mode では editor の代わりに unavailable note が見える

### ACC-028 Timeline keyboard edit
**Given** Project Detail に scheduled task があり、timeline bar を focus している  
**When** `Alt+→` を押し、その後 `Alt+Shift+→` を押す  
**Then**
- `Alt+→` で開始日と終了日が1単位右へ移動する
- `Alt+Shift+→` で終了日だけが1単位伸びる
- focus した bar が selected item と同期する
- milestone marker では keyboard resize が発火しない

### ACC-030 Timeline focus traversal
**Given** Project Detail に scheduled item が2件以上あり、先頭の timeline bar または marker を focus している  
**When** `ArrowDown` を押し、その後 `ArrowUp` を押す  
**Then**
- `ArrowDown` で次の visible timeline item へ focus が移る
- `ArrowDown` 後は selected item も次の item に同期する
- `ArrowUp` で直前の visible timeline item へ focus が戻る

### ACC-031 Reschedule dialog keyboard
**Given** 親子の scheduled item があり、親の timeline move で reschedule scope dialog が開いている  
**When** `Tab / Shift+Tab` を確認した後、`Escape` で閉じ、再度 dialog を開いて `ArrowLeft` で `single` へ移動し `Enter` を押す  
**Then**
- 最初の dialog は閉じるだけで変更を適用しない
- 再度開いた dialog では既定選択 `with_descendants` に focus がある
- `Tab` で dialog 内の次の button に移動し、最後の button からさらに `Tab` すると先頭へ戻る
- `Shift+Tab` で逆方向に移動し、先頭からさらに `Shift+Tab` すると最後へ戻る
- `ArrowLeft` 後は `single` が active/focus になる
- `Enter` で `single` が適用され、親だけが移動して子の日付は変わらない
- 最初の `Escape` 後は元の timeline item に focus が戻る
- `Enter` 適用後も同じ timeline item に focus が戻る

### ACC-032 Project detail row virtualization
**Given** Project Detail に多数の visible row があり、WBS と timeline が同時表示されている  
**When** 下方向へスクロールする  
**Then**
- WBS と timeline は同じ visible row window を描画する
- top / bottom spacer により scroll height は維持される
- DOM 上の row 数は visible window + overscan の範囲に収まる
- selected row と timeline focus traversal は virtualization 後も維持される

### ACC-037 Roadmap row virtualization
**Given** Year / FY roadmap に多数の row があり、quarter header と month header が表示されている  
**When** roadmap body を下方向へスクロールする  
**Then**
- quarter header と month header は表示されたまま維持される
- body row は visible window + overscan の範囲だけ描画される
- top / bottom spacer により scroll height は維持される
- expand/collapse と project open の click target は virtualization 後も維持される

### ACC-038 Portable build artifact
**Given** Windows desktop build 環境で依存関係が解決済み  
**When** `powershell -ExecutionPolicy Bypass -File scripts/build.ps1` を実行  
**Then**
- `artifacts/` 配下に version 付き portable staging folder が生成される
- 同じ `artifacts/` 配下に対応する `.zip` artifact が生成される
- staging folder には `dist/`, `dist-electron/`, `node_modules/sql.js/dist/sql-wasm.wasm`, `Launch SGC.cmd`, Electron runtime が含まれる
- zip を展開しても同じ構成が得られる
- `Launch SGC.cmd` は bundled Electron runtime を使って app root を起動する

### ACC-016 Excel export workbook
**Given** プロジェクトデータあり  
**When** Project Detail から XLSX export を実行し、保存先を確定する  
**Then**
- 4シート出力される
- sheet 順序は `Dashboard -> Tasks -> Gantt_View -> MasterData`
- `Tasks` シートに canonical 列が定義順で並ぶ
- `DependsOn` は `itm_101,itm_102+2` 形式で出力される
- 保存先に `.xlsx` ファイルが作成される

### ACC-017 Excel import preview
**Given** 更新対象XLSX  
**When** Project Detail から import preview を実行  
**Then**
- new / update / error 件数が表示される
- commit 前に中身確認できる
- preview row ごとに action とタイトルが見える
- `全件 / warning / error` filter で preview row を絞り込める
- warning を持つ row は panel 上部の warning summary にも `row number / title / warning reason` 付きで見える
- warning を持つ row は dedicated warning-only table にも見え、error row はその表に含まれない
- browser fallback でも file picker から preview を開ける
- browser fallback でも preview 済み workbook を current project へ apply できる
- error row では invalid field と理由が見える
- current project と一致しない `ProjectCode / ProjectName` row は error になる
- 不正な `ParentRecordId` row は error になる
- 不正な `DependsOn` token row は error になる
- workbook の `LastModifiedAt` が既存 item より古い update row では warning が見える
- import 後の `DependsOn` が current project graph に cycle を作る update row では warning が見える
- update row では `差分` を開くと field ごとの before / after が見える

### ACC-018 Excel round-trip
**Given** export した workbook  
**When** Project Detail で preview 後に一部タイトルと日付を変えた workbook を apply import  
**Then**
- 対応する item が更新される
- ID が無い新規行は追加される
- valid な `DependsOn` は finish-to-start dependency として反映される
- `tmp_*` temporary ID を使った new row 同士の `DependsOn` も finish-to-start dependency として反映される
- successor の `DependsOn` を空にした行は既存 dependency が外れる
- `error` 行は反映されない
- browser fallback でも valid な `DependsOn` は current project に対して反映される

### ACC-029 Excel import compare preview
**Given** current project に既存 item があり、workbook 側でタイトルまたは日付を変更している  
**When** import preview で update row の `差分` を開く  
**Then**
- field ごとの before / after が見える
- 初期実装では canonical `Tasks` の主要編集列だけを比較対象にする
- new row と error row には compare toggle を出さない

## P2

### ACC-019 Recurring weekly task
**Given** scheduled task に `FREQ=WEEKLY;INTERVAL=1;BYDAY=MO` の recurrence rule があり、`next_occurrence_at` が翌週月曜を指している  
**When** 現在の recurring task を `done` にする  
**Then**
- 同じ project / parent 配下に次の occurrence が1件だけ生成される
- 新しい occurrence は `status=not_started`, `percentComplete=0`, `completedAt=null` になる
- 新しい occurrence の開始日は `next_occurrence_at`、終了日は元 task の duration を保った日付になる
- recurrence rule は新しい occurrence へ移り、元 task の `isRecurring` は false、新しい occurrence の `isRecurring` は true になる
- recurrence rule の `next_occurrence_at` はさらに次の週へ進む

### ACC-039 Recurrence rule persistence
**Given** scheduled task が1件あり、recurrence rule model が有効  
**When** item に recurrence rule を保存し、その後削除する  
**Then**
- item ごとに 1件の recurrence_rule が保存される
- 保存直後の item は `isRecurring=true` になる
- 保存済み rule は item 単位で再取得できる
- 削除後は recurrence_rule が消え、item は `isRecurring=false` に戻る
- group / milestone / archived item には recurrence rule を保存できない

### ACC-040 WBS template save
**Given** project 内に root item とその子孫、および無関係な sibling item がある  
**When** root item を WBS template として保存する  
**Then**
- `kind=wbs` の template が1件保存される
- template 名は明示名または root item の title で保存される
- template body には root item と非 archived descendant だけが hierarchy 付きで入る
- sibling item と archived descendant は template body に含まれない
- 初期保存対象は `type / title / note / priority / assigneeName / tags / estimateHours / durationDays` に限定される

### ACC-041 WBS template apply
**Given** 保存済み `kind=wbs` template があり、target project に既存 root item がある  
**When** template を target project へ apply する  
**Then**
- template の root と descendant が target project の root 直下へ subtree として追加される
- 既存 item の後ろへ append され、WBS code は再計算される
- template の hierarchy と `type / title / note / priority / assigneeName / tags / estimateHours / durationDays` が復元される
- 生成 item の `status=not_started`, `percentComplete=0`, `actualHours=0`, `completedAt=null`, `isScheduled=false`, `isRecurring=false` になる
- `startDate / endDate / dueDate / dependency / recurrence` は復元されない

### ACC-042 Project template save
**Given** project とその非 archived root item / descendants があり、project に code や schedule 済み field も入っている  
**When** project を `kind=project` template として保存する  
**Then**
- `kind=project` の template が1件保存される
- template 名は明示名または project 名で保存される
- project-level では `name / description / ownerName / priority / color` だけが body に入る
- item-level では非 archived root item / descendants だけが hierarchy 付きで入る
- item-level 保存対象は `type / title / note / priority / assigneeName / tags / estimateHours / durationDays` に限定される
- `code / status / startDate / endDate / targetDate / progressCached / riskLevel / dependency / recurrence` は body に含まれない

### ACC-043 Project template apply
**Given** 保存済み `kind=project` template がある  
**When** template を apply して新しい project を生成する  
**Then**
- 新しい project が1件作成される
- project-level では `name / description / ownerName / priority / color` が復元される
- 新しい project の `code` は source project をそのまま再利用せず、新規採番される
- template の root item / descendants が新しい project の root subtree として復元される
- item-level では `type / title / note / priority / assigneeName / tags / estimateHours / durationDays` が復元される
- 生成 project の `status=not_started`, `startDate=null`, `endDate=null`, `targetDate=null`, `progressCached=0` になる
- 生成 item の `status=not_started`, `percentComplete=0`, `actualHours=0`, `completedAt=null`, `isScheduled=false`, `isRecurring=false` になる
- `startDate / endDate / dueDate / dependency / recurrence` は復元されない

### ACC-020 Backup recovery
**Given** 直近バックアップあり  
**When** DB 異常を検知  
**Then**
- 復旧導線が提示される

### ACC-032 Manual local backup
**Given** desktop app で project / item が保存済み  
**When** sidebar の `Backup now` を実行  
**Then**
- timestamp 付き local backup file が作成される
- recent backup list に新しい entry が追加される
- backup file を別 DB として開くと保存済み project / item が見える

### ACC-033 Backup restore preview
**Given** recent backup が1件以上あり、backup 内に project / item が保存されている  
**When** sidebar の recent backup row から `Restore Preview` を開く  
**Then**
- `file name / created at / size` が見える
- `project count / item count / latest updatedAt` が見える
- current DB の project / item はその時点では変更されない

### ACC-034 Manual backup restore
**Given** recent backup があり、その作成後に current DB が変更されている  
**When** restore preview から confirm 付きで `Restore` を実行  
**Then**
- desktop では restore 前に safety backup が自動作成される
- current DB は選択した backup の内容へ戻る
- restore 後に app state が再読込される
- restore 後の notice から restored backup と safety backup の両方を確認できる

### ACC-035 Auto backup retention
**Given** app bootstrap 時点で今日の `sgc-auto-backup-*` がまだ無く、古い auto backup が8件ある  
**When** app を起動する  
**Then**
- 今日の `sgc-auto-backup-*` が1件だけ追加される
- `sgc-auto-backup-*` は最新7件だけ残る
- manual backup (`sgc-backup-*`) と safety backup (`sgc-safety-backup-*`) は retention で削除されない
- 同じ local day に再度 bootstrap しても追加の auto backup は作られない

### ACC-036 Recovery prompt on startup anomaly
**Given** DB 初期化または bootstrap が失敗し、recent backup が1件以上ある  
**When** app を起動する  
**Then**
- 通常 workspace の代わりに recovery screen が開く
- startup error summary が見える
- recent backup list と `Restore Preview` が見える
- recovery screen の preview では backup 内容を読める
- recovery screen の preview から confirm 付き `Restore` を実行できる
- desktop では restore 前に safety backup が自動作成される
- restore 成功後は通常 workspace へ戻り、restored backup と safety backup の notice が見える
