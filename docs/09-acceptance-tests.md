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
**When** `Escape` で閉じた後、再度 dialog を開いて `ArrowLeft` で `single` へ移動し `Enter` を押す  
**Then**
- 最初の dialog は閉じるだけで変更を適用しない
- 再度開いた dialog では既定選択 `with_descendants` に focus がある
- `ArrowLeft` 後は `single` が active/focus になる
- `Enter` で `single` が適用され、親だけが移動して子の日付は変わらない

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
- browser fallback の preview panel では `DependsOn` が apply 時に skip されることが見える
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
- browser fallback の初期 commit では `DependsOn` を apply しない

### ACC-029 Excel import compare preview
**Given** current project に既存 item があり、workbook 側でタイトルまたは日付を変更している  
**When** import preview で update row の `差分` を開く  
**Then**
- field ごとの before / after が見える
- 初期実装では canonical `Tasks` の主要編集列だけを比較対象にする
- new row と error row には compare toggle を出さない

## P2

### ACC-019 Recurring weekly task
**Given** 毎週月曜の繰り返し設定  
**When** 次週に進む  
**Then**
- 新しい occurrence が生成される

### ACC-020 Backup recovery
**Given** 直近バックアップあり  
**When** DB 異常を検知  
**Then**
- 復旧導線が提示される
