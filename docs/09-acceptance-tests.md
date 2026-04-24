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

### ACC-044 Project detail drag reorder and context menu
**Given** Project Detail に sibling row と child row がある  
**When** 1行を別の sibling の上下へドラッグし、その後 row を右クリックする  
**Then**
- row の sort order が更新される
- parent と一緒に child subtree も移動する
- WBS code が再計算される
- 再読込後も順序が保持される
- row-scoped の最小コンテキストメニューが開く

### ACC-049 Project detail context menu
**Given** Project Detail に item row がある  
**When** row を右クリックして最小コンテキストメニューを開き、`子追加` または `詳細` を選ぶ  
**Then**
- row-scoped の最小コンテキストメニューが開く
- `子追加` で対象 row 配下に child item が追加される
- `詳細` で対象 row が selected item になる
- menu を閉じると project detail の通常操作へ戻る

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

### ACC-048 Excel default settings
**Given** Settings 画面を開いている  
**When** `優先度既定値` と `担当既定値` を保存してからアプリを再起動し、project export を実行する  
**Then**
- 設定値が再起動後も保持される
- project export の `MasterData` sheet に `Default / Priority / <saved value>` が出る
- project export の `MasterData` sheet に `Default / Assignee / <saved value>` が出る

### ACC-038 Portable build artifact
**Given** Windows desktop build 環境で依存関係が解決済み  
**When** `powershell -ExecutionPolicy Bypass -File scripts/build.ps1` を実行  
**Then**
- `artifacts/` 配下に version 付き portable staging folder が生成される
- 同じ `artifacts/` 配下に対応する `.zip` artifact が生成される
- staging folder には `dist/`, `dist-electron/`, `node_modules/sql.js/dist/sql-wasm.wasm`, `Launch SGC.cmd`, Electron runtime が含まれる
- zip を展開しても同じ構成が得られる
- `Launch SGC.cmd` は bundled Electron runtime を使って app root を起動する

### ACC-045 Search and filter drawer
**Given** 複数 project / item があり、title / note / project / portfolio / status / priority / tag / assignee / overdue / milestone 条件で差が出る  
**When** Search / Filter Drawer を開いて条件を組み合わせる  
**Then**
- current view の一覧または roadmap が条件に合う行だけへ絞り込まれる
- active filter が見える
- `clear` で既定表示へ戻せる
- `年間表示対象のみ` を有効にすると roadmap 向け対象だけへ絞り込める

### ACC-050 Search and filter drawer first slice
**Given** Home / Portfolio / Year-FY Roadmap を開けるデータがあり、project の一部には `portfolio_id` が入っている  
**When** current view で Search / Filter Drawer を開き、全文、project、portfolio、status、priority、tag、assignee、overdue、milestone、年間表示対象のみ を組み合わせる  
**Then**
- current view が条件に合う row だけへ絞り込まれる
- existing quick filter chip がある view では drawer 条件と AND で併用される
- active filter chip が drawer 外にも見える
- `Clear` で drawer 条件が初期値へ戻る

### ACC-051 Project detail search and filter drawer preserves hierarchy context
**Given** Project Detail に parent / child / sibling row があり、child row だけが全文条件に一致する  
**When** Search / Filter Drawer を開いて全文または status / tag / assignee 条件を指定する  
**Then**
- 一致した child row は表示される
- その child へ辿る ancestor row も同時に表示される
- 一致しない sibling subtree は hidden になる
- WBS と timeline は同じ filtered row window を共有する
- `Clear` で元の visible row へ戻る

### ACC-046 Settings core preferences
**Given** Settings 画面があり、既定値から変更可能な設定がある  
**When** 表示言語 / 週開始曜日 / FY開始月 / 稼働日 / テーマ / 既定表示 / 自動バックアップ設定 / Excel テンプレート既定値 を変更して保存し、アプリを再起動する  
**Then**
- 変更内容が再起動後も保持される
- FY開始月は roadmap 表示へ反映される
- 稼働日は dependency 自動シフトへ反映される
- 既定表示は起動直後の初期 view に反映される

### ACC-052 Settings shell first slice
**Given** sidebar から開ける Settings 画面がある  
**When** `週開始曜日 / FY開始月 / 既定表示` を変更して保存し、同じ user data でアプリを再起動する  
**Then**
- 3項目の変更内容が再起動後も保持される
- `FY開始月` は Year / FY Roadmap の FY month bucket と quarter header に反映される
- `週開始曜日` は Home / Today の `今週マイルストーン` 判定に反映される
- `既定表示` は起動直後の初期 view に反映される
- first slice では `表示言語 / 稼働日 / テーマ / 自動バックアップ設定 / Excel テンプレート既定値` は placeholder または未実装表示でもよい

### ACC-053 Settings custom working days
**Given** Settings 画面と dependency を持つ project detail がある  
**When** `稼働日` を `日-木` に変更して保存し、その後 predecessor の終了日を木曜へ動かして `with_dependents` を適用する  
**Then**
- `稼働日` の選択内容が再起動後も保持される
- dependency 自動後ろ倒しの next working day 計算に `日-木` が使われる
- 金土をまたぐ場合、successor は次の日曜以降へ送られる
- `稼働日` を0件にする保存はできない

### ACC-054 Settings language first slice
**Given** Settings 画面と sidebar navigation がある  
**When** `表示言語` を `English` へ変更して保存し、同じ user data でアプリを再起動する  
**Then**
- `表示言語` の選択内容が再起動後も保持される
- sidebar navigation の主要 view label が英語へ切り替わる
- Settings 自身の見出しと主要 field label が英語へ切り替わる
- Home / Portfolio / Year-FY Roadmap / Project Detail の主要見出しまたは主要 action label の少なくとも一部で英語切替を確認できる
- initial slice では全 UI 文言の完全翻訳までは要求しない

### ACC-055 Settings theme first slice
**Given** Settings 画面と sidebar navigation がある  
**When** `テーマ` を `ダーク` へ変更して保存し、同じ user data でアプリを再起動する  
**Then**
- `テーマ` の選択内容が再起動後も保持される
- shell root に dark theme が反映される
- sidebar、主要 card、button、input の少なくとも一部で dark palette を確認できる
- `ライト` に戻して保存すると同じ user data 上で light palette に戻る
- initial slice では chart や status color の完全な theme 対応までは要求しない

### ACC-062 Theme token coverage
**Given** Settings から `テーマ` を `ダーク` へ変更できる workspace がある
**When** dark theme を保存し、chart / status / import preview / roadmap / portfolio surface を表示する
**Then**
- status pill、warning / info surface、table header、roadmap / portfolio row、timeline bar / marker / grid が semantic theme token を参照する
- dark theme で淡色固定の preview row や status color が主要 surface に残らない
- `ライト` に戻すと同じ token 名で light palette の値へ戻る
- acceptance smoke では representative token の dark / light 切替を固定する

### ACC-060 Multilingual overlay and drawer parity
**Given** `表示言語` を `English` へ変更済みの workspace がある  
**When** Search / Filter Drawer、Excel Import Preview、recovery / restore overlay の主要 panel を開く  
**Then**
- panel heading と primary action が英語で見える
- helper copy と empty copy の主要文言も英語へ切り替わる
- active filter chip は英語ラベルで見える
- `表示言語` を `日本語` へ戻すと同じ panel 群が日本語で見える

### ACC-056 Auto backup settings first slice
**Given** Settings 画面と Data Protection card がある  
**When** `自動バックアップ` を off にし、`保持件数` を `3` に変更して保存し、同じ user data でアプリを再起動する  
**Then**
- `自動バックアップ` の on/off と `保持件数` が再起動後も保持される
- sidebar の Data Protection policy copy に current settings が反映される
- service / browser fallback では `自動バックアップ` off 中の bootstrap で auto backup create / retention を実行しない
- `自動バックアップ` を on に戻すと、以後の bootstrap では `保持件数` を使って `sgc-auto-backup-*` 系列だけへ retention が適用される

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

### ACC-047 Template UI flow
**Given** Inbox item、WBS root item、project template source project、保存済み template がある  
**When** UI から template save / list / apply / template conversion を行う  
**Then**
- WBS template と project template を UI から保存できる
- 保存済み template を UI 一覧から選べる
- WBS template を current project へ apply できる
- project template から新しい project を作成できる
- Inbox の `テンプレート変換` から template workflow を起動できる

### ACC-057 Template apply UI first slice
**Given** Project Detail を開いており、saved `kind=wbs` template と saved `kind=project` template が1件以上ある  
**When** toolbar の `Templates` button から panel を開き、`kind=wbs` template を current project へ apply し、その後 `kind=project` template から新しい project を作成する  
**Then**
- template panel に `WBS Templates` と `Project Templates` が分かれて表示される
- 各 template row では `name` と `updatedAt` が見える
- `kind=wbs` template の apply 後、current project の root 直下へ subtree が追加される
- `kind=project` template の apply 後、新しい project が作成されて selection がその project に切り替わる
- first slice では save action と Inbox の `テンプレート変換` は UI に含めない

### ACC-058 Template save UI follow-up
**Given** Project Detail を開いており、current project と selected root row がある  
**When** toolbar の `Templates` button から panel を開き、`Save current project as template` と `Save selected root as WBS template` を実行する  
**Then**
- panel を閉じずに `kind=project` template と `kind=wbs` template が一覧へ追加される
- project template の既定名には current project 名が使われる
- WBS template の既定名には selected root title が使われる
- selected row が root でない時は WBS save action は disabled になり、helper copy で理由が見える
- follow-up slice では name 入力 modal や Inbox の `テンプレート変換` はまだ要求しない

### ACC-059 Inbox template conversion
**Given** Inbox に未計画 item が1件あり、template save/list/apply UI は既に使える  
**When** Inbox card の `テンプレート変換` を実行する  
**Then**
- item title を既定名にした draft project が1件作成される
- 対象 item は draft project の root row として移動し、Inbox 一覧から外れる
- view は Project Detail へ切り替わる
- `Templates` panel が自動で開く
- panel 内では `Save current project as template` と `Save selected root as WBS template` の両方をそのまま使える

### ACC-048 Recurrence UI flow
**Given** Detail drawer を開ける scheduled task がある  
**When** UI から recurrence rule を追加、更新、削除する  
**Then**
- recurrence rule が永続化される
- task の `isRecurring` が UI と同期する
- first slice では `週次(月曜) / 月次 / 平日` preset だけを選べる
- first slice では `next_occurrence_at` を date input で保存できる
- unsupported rule は保存できても generation 対象外であることが見える
- unsupported rule が既にある場合でも UI から削除できる
- group / milestone / unscheduled item では recurrence editor は unavailable note に置き換わる
- recurring task を `done` にすると既存 MVP ルールどおり次の occurrence が1件生成される

### ACC-061 Generic recurrence builder
**Given** unsupported recurrence rule を持つ scheduled task の Detail drawer を開いている  
**When** cadence builder から yearly rule を保存し、その後 weekly の任意曜日 / interval rule へ再構築して保存する  
**Then**
- yearly rule は保存されるが generation 対象外として見える
- unsupported rule は raw text 直接編集ではなく builder から再構築できる
- weekly 任意曜日 / interval rule へ置き換えると supported summary として表示され、unsupported note は消える

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
