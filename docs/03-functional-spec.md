# 03 Functional Specification

## 3.1 画面一覧

- FS-001 Home / Today
- FS-002 Inbox
- FS-003 Project Detail
- FS-004 Portfolio
- FS-005 Year / FY Roadmap
- FS-006 Search / Filter Drawer
- FS-007 Import / Export
- FS-008 Settings

## 3.2 機能仕様詳細

### FS-001 Home / Today
目的: 今日やることと危険箇所を最短で把握する

#### 表示要素
- 今日のタスク
- 期限切れ
- 今週のマイルストーン
- 最近更新したプロジェクト
- Quick Capture バー

#### 操作
- タスク完了
- 日付のワンタップ延期
- プロジェクト詳細へ遷移
- フィルタチップ切り替え

### FS-002 Inbox
目的: 未整理タスクをためて後で計画に載せる

#### 表示要素
- 未計画タスク一覧
- 推奨アクション
- 一括編集バー

#### 操作
- プロジェクト割当
- 日付追加
- タグ追加
- テンプレート変換
- 削除 / アーカイブ

#### 既定動作
- Inbox の `日付追加` は単日 picker を使う
- 日付を1つ選んだ時点で `startDate` と `endDate` の両方に同日を設定する
- 日付が入った item は `scheduled=true` となり Inbox 一覧から外れる
- Inbox の `タグ追加` は free-text 1欄で受ける
- タグはスペースまたはカンマ区切りで複数入力でき、`#` は省略可
- タグ追加だけでは item は Inbox に残る

### FS-003 Project Detail
目的: プロジェクト内訳と日程を同時に扱う

#### レイアウト
- 左: WBS ツリー
- 右: ガントタイムライン
- 上: プロジェクトヘッダ
- 下: 補助パネル（詳細 / コメント / 履歴は MVP では詳細のみ）

#### WBS列
- WBSコード
- 種別
- タイトル
- 状態
- 優先度
- 担当
- 開始日
- 終了日
- 進捗
- 依存
- タグ

#### 操作
- 行追加
- インデント / アウトデント
- ドラッグ並び替え
- 展開 / 折りたたみ
- 進捗編集
- ドラッグで日程変更
- focused timeline bar に対する keyboard での日程変更
- 右クリックの最小コンテキストメニュー
- detail drawer から selected item の dependency を追加 / 削除

#### 初期 performance ルール
- Project Detail の WBS / timeline は同じ visible row window を共有する
- 初期 virtualization は Project Detail の行描画だけを対象にし、Portfolio / Roadmap には広げない
- 初期 virtualization は fixed row height を前提にし、WBS row と timeline row の縦サイズを揃える
- scroll 高さは top / bottom spacer で維持し、visible row の前後には overscan row を含める
- 展開 / 折りたたみ / 選択 / timeline focus は virtualization 後も row identity を保持する

### FS-004 Portfolio
目的: 複数大規模案件の横断把握

#### 行レベル
- Portfolio
- Project
- Phase（展開時）

#### 列
- 名前
- 状態
- 進捗
- 期限超過数
- 次マイルストーン
- 直近7日変更数
- リスク
- 担当主要者

#### ルール
- デフォルトは Project 単位
- 初期 filter は `全案件 / 遅延中 / 今週マイルストーン`
- `遅延中` は `overdueCount >= 1` の project に絞る
- `今週マイルストーン` は `nextMilestoneDate` が今週内の project に絞る
- 展開すると主要 Phase を表示
- 遅延中プロジェクトは視覚強調
- Project row クリックで Project Detail へ移動
- `次マイルストーン` は未完了 milestone のうち effective date が最も早いものを返す
- `期限超過数` は未完了かつ effective date が今日より前の item 件数を返す
- `直近7日変更数` は archive されていない item の `updated_at` が直近7日以内の件数を返す
- `riskLevel` は MVP では query 時に算出してよい
- `主要 Phase` は project 配下の root-level `group` item を優先し、sort_order 順で返す
- root-level の task / milestone は project row 直下の情報として扱い、phase row には含めない

### FS-005 Year / FY Roadmap
目的: 長期計画を俯瞰する

#### 表示粒度
- 年
- FY
- 四半期
- 月

#### 表示対象
- プロジェクト
- フェーズ
- マイルストーン
- 大きなタスク（設定でしきい値以上）

#### ルール
- 1日単位の細かいバーは非表示に寄せる
- マイルストーンは菱形
- 四半期背景帯を表示
- FY 開始月を設定から反映
- Year view は選択年の 1月-12月を表示する
- FY view は `FY2026` のような表示年を fiscal year の開始年として扱い、FY開始月=4 の場合は `2026-04` から `2027-03` を表示する
- Year view の quarter header は暦年基準の `Q1-Q4` を使う
- FY view の quarter header は FY 開始月基準の `Q1-Q4` を使い、FY開始月=4 の場合は `Q1=4-6月`, `Q2=7-9月`, `Q3=10-12月`, `Q4=1-3月` とする
- roadmap の初期 filter は `全件 / 期限超過 / マイルストーン` を提供する
- `期限超過` は effective date が今日より前で未完了の row に絞る
- `マイルストーン` は milestone row に絞り、該当 row がある project の project row は文脈維持のため残してよい
- 縦軸は Portfolio / Project / Phase の3層までを基本表示
- root-level `group` row には展開ボタンを置き、必要時に dated descendant を開ける
- dated descendant を持つ undated group は context row として残してよい
- 深いタスクは初期表示では閉じ、明示展開時のみ表示する
- 初期 roadmap virtualization は row body のみを対象にし、quarter header / month header は常時描画する
- 初期 roadmap virtualization は fixed row height を前提にし、scroll 高さは top / bottom spacer で維持する
- 初期 roadmap virtualization は filter / expand / project open の挙動を変えず、visible row の前後には overscan row を含める

### FS-006 Search / Filter Drawer
目的: 今見たい範囲に絞る

#### 条件
- タイトル / メモ全文
- プロジェクト
- Portfolio
- 状態
- 優先度
- タグ
- 担当
- 期限超過のみ
- マイルストーンのみ
- 年間表示対象のみ

### FS-007 Import / Export
目的: Excel 往復と一括投入

#### Import
- XLSX / CSV
- 新規作成 / 更新 / スキップの dry-run プレビュー
- バリデーションエラー一覧
- ID が無い行は新規作成
- ID が一致する行は更新
- 初期実装では Project Detail から `.xlsx` の canonical `Tasks` シート preview を先に提供する
- 初期 preview は commit を行わず、`new / update / error` 件数と行一覧を表示する
- error row は列単位の validation issue を複数件保持できる
- update row では workbook の `LastModifiedAt` が既存 item の `updatedAt` より古い場合に warning を表示する
- 初期 preview panel では `全件 / warning / error` filter を切り替えられる
- 初期 preview panel では warning を1件以上持つ row を上部に集約表示し、`row number / title / warning reason` を先に確認できる
- 初期 preview panel では warning summary とは別に warning-only table を置き、warning を持つ row だけを `row / project / title / warning` 列で独立比較できる
- 初期 preview panel では `action=update` row に限って差分比較を開ける
- 差分比較は field ごとの before / after を inline 表示し、初期実装では canonical `Tasks` の主要編集列だけを対象にする
- browser fallback では file picker から `.xlsx` を選んで preview を出し、そのまま current project へ commit できる
- browser fallback の初期 import は SGC export が出す store-only workbook を主対象とする
- browser fallback の初期 commit は preview 済み workbook を browser memory 上の current project へ apply する
- browser fallback の initial commit では preview を通過した `DependsOn` も current project に対して apply する
- browser fallback の `DependsOn` apply は current project の既知 item ID と同一 workbook 内の `tmp_*` temporary ID を解決できる範囲に限定する
- 初期 commit は Project Detail で開いている current project に対してのみ適用する
- current project import では `ProjectCode / ProjectName` が現在の import target と一致しない row を error として隔離する
- 初期 preview では `DependsOn` の token 形式と参照先妥当性だけを検証し、current project 外参照 / 自己参照 / 不明 ID を error として隔離する
- 初期 preview では `DependsOn` の token が current project graph に対して cycle を作る場合、error にはせず warning を表示する
- workbook 内の new row 同士を `DependsOn` で結びたい場合は、new row の `RecordId` に `tmp_` で始まる workbook-local temporary ID を入れてよい
- `DependsOn` は current project の既知 item ID に加えて、同一 workbook 内で一意な `tmp_*` temporary ID も参照できる
- 初期 commit は preview 済み workbook の `new / update` 行だけを適用し、`error` 行は skip する
- 初期 commit の更新対象は canonical `Tasks` の基本編集列 (`Title / ItemType / Status / Priority / Assignee / StartDate / EndDate / DueDate / DurationDays / PercentComplete / EstimateHours / Note / Tags`) とする
- 初期 commit は `DependsOn` について、current project の既知 predecessor を参照する finish-to-start edge だけを successor 単位で置き換える
- 初期 commit は workbook 内の `tmp_*` temporary ID を、同じ import で新規作成された item の実 ID へ解決してから `DependsOn` を保存する
- 初期 commit の新規行は root 直下または既存 parent 指定までを扱い、dependency / rollback / project 横断 import は後続 slice とする

#### Export
- 現在フィルタ結果を出力可能
- プロジェクト単位 / Portfolio 単位 / 全体
- 印刷向け表示と再取込向け表示を分ける
- 初期実装では Project Detail から project 単位 export を先に提供する
- export 実行時は OS の保存ダイアログを開き、保存先が確定した場合のみ `.xlsx` を書き出す

### FS-008 Settings
- 表示言語
- 週開始曜日
- FY 開始月
- 稼働日
- テーマ
- 既定表示
- 自動バックアップ設定
- Excel テンプレート既定値
- 初期 hardening では settings 画面より先に `Backup now` を sidebar utility として提供する
- `Backup now` は現在の SQLite DB を timestamp 付きローカル backup ファイルとして保存する
- 初期 backup UI では recent backups を新しい順に表示する
- 初期 restore slice では recent backup から read-only restore preview を開ける
- restore preview では `file name / created at / size / project count / item count / latest updatedAt` を表示する
- restore preview は backup snapshot を読むだけで、current DB にはまだ変更を加えない
- 初期 restore apply slice では preview 中の backup に対して confirm 後に restore を実行できる
- desktop restore は apply 前に current DB の safety backup を自動作成する
- restore apply 後は app state を再読込し、restored backup の内容を current state に反映する
- browser fallback では desktop の SQLite file copy の代わりに in-memory snapshot を restore する
- 初期 auto backup slice では app bootstrap 時に local day あたり1回だけ `sgc-auto-backup-*` を自動作成する
- auto backup の retention は `sgc-auto-backup-*` 系列にだけ適用し、最新7件を超えた古い auto backup を削除する
- manual backup (`sgc-backup-*`) と safety backup (`sgc-safety-backup-*`) はこの retention では削除しない
- 初期 recovery prompt slice では DB 初期化や bootstrap 失敗を検知した場合でも app window 自体は開き、通常 workspace の代わりに recovery screen を表示する
- recovery screen では startup error message と recent backups を表示し、backup preview を経由した restore を許可する
- recovery screen から restore を実行する場合も desktop では apply 前に current DB file の safety backup を自動作成する
- recovery screen からの restore 成功後は current session を再初期化し、通常 workspace へ戻す
- recovery mode 中は project/item の通常操作を無効化し、recent backup の確認と復旧導線を優先する

### FS-009 Templates and Recurrence
目的: 定型タスク生成の元データを保持する

- 初期 recurrence model は item 単位で 1 rule を保持する
- 初期 recurrence model は raw `rrule_text` と `next_occurrence_at` を永続化する
- 初期 recurrence model は task item のみを対象にし、group / milestone には保存しない
- recurrence rule を保存した item は `isRecurring=true` に同期する
- recurrence rule を削除した item は `isRecurring=false` に戻る
- 初期 recurring generation は recurring task が `done` へ遷移した時だけ発火する
- 初期 recurring generation は rule の `next_occurrence_at` を次の occurrence の開始日として 1件だけ生成する
- 初期 recurring generation で作られる occurrence は元 task の `title / note / priority / assignee / tags / estimate_hours / duration_days` を引き継ぎ、`status=not_started`, `percentComplete=0`, `completedAt=null` に戻す
- 初期 recurring generation では recurrence rule を完了済み occurrence から新しい occurrence へ移し、古い item の `isRecurring` は false、新しい item の `isRecurring` は true にする
- 初期 recurring generation の rule advance は `FREQ=WEEKLY`, `FREQ=MONTHLY`, `FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR` のみに対応する
- unsupported な `rrule_text` は永続化はするが、この slice では occurrence 自動生成を行わない
- 初期 WBS template は selected root item 1件とその非 archived descendants を subtree ごとに保存する
- 初期 WBS template の保存対象フィールドは `type / title / note / priority / assigneeName / tags / estimateHours / durationDays` とする
- 初期 WBS template は hierarchy だけを保存し、`status / percentComplete / actualHours / startDate / endDate / dueDate / dependency / recurrence` は保存しない
- 初期 WBS template の保存対象 root は project 内 item に限定し、保存時には root item の title を既定 template 名に使ってよい
- 初期 WBS template は `kind=wbs` のみを扱う
- 初期 WBS template apply は saved template を target project の root 直下へ subtree として末尾追加する
- 初期 WBS template apply は `type / title / note / priority / assigneeName / tags / estimateHours / durationDays` だけを復元する
- 初期 WBS template apply で作られる item は `status=not_started`, `percentComplete=0`, `actualHours=0`, `completedAt=null`, `isScheduled=false`, `isRecurring=false` とする
- 初期 WBS template apply では `startDate / endDate / dueDate / dependency / recurrence` は復元しない
- 初期 project template save は selected project 1件とその非 archived root item / descendants を `kind=project` template として保存する
- 初期 project template save の project-level 保存対象は `name / description / ownerName / priority / color` に限定する
- 初期 project template save の item-level 保存対象は WBS template と同じく `type / title / note / priority / assigneeName / tags / estimateHours / durationDays` に限定する
- 初期 project template save では `code / status / startDate / endDate / targetDate / progressCached / riskLevel / dependency / recurrence` は保存しない
- 初期 project template apply は saved `kind=project` template から新しい project を1件作成する
- 初期 project template apply の project-level 復元対象は `name / description / ownerName / priority / color` に限定する
- 初期 project template apply で生成される project の `code` は新規採番し、`status=not_started`, `startDate=null`, `endDate=null`, `targetDate=null`, `progressCached=0`, `riskLevel=normal` とする
- 初期 project template apply では saved root item / descendants を新しい project の root subtree として復元する
- 初期 project template apply の item-level 復元対象は `type / title / note / priority / assigneeName / tags / estimateHours / durationDays` に限定する
- 初期 project template apply で生成される item は `status=not_started`, `percentComplete=0`, `actualHours=0`, `completedAt=null`, `isScheduled=false`, `isRecurring=false` とする
- 初期 project template apply では `startDate / endDate / dueDate / dependency / recurrence` は復元しない

## 3.3 ドメインルール

### Item Type
- `group`: 親要素 / フェーズ / 見出し
- `task`: 通常タスク
- `milestone`: 期間を持たない到達点

### Status
- `not_started`
- `in_progress`
- `blocked`
- `done`
- `archived`

### Priority
- `low`
- `medium`
- `high`
- `critical`

### Reschedule Scope
- `single`
- `with_descendants`
- `with_dependents`
- `with_descendants` は親 item を移動したとき、同じ日数差分を子孫へ一括適用する
- 初期実装では timeline move のように一意な日数差分を導出できる編集を対象に `with_descendants` を適用する
- `with_dependents` はまず編集中 item の子孫を同じ差分で保ち、その上で dependency 制約を破る後続 item があれば必要最小限だけ後ろへ送る
- 後続 item が移動した場合、その子孫も同じ日数差分で一緒に移動する
- 初期実装では前倒しは行わず、遅延方向の calendar-day shift のみを扱う
- working day logic の初期適用範囲は dependency による自動後ろ倒しのみとする
- 既定の working day は月〜金で、土日をまたぐ自動シフトは次の稼働日へ送る
- reschedule scope dialog の keyboard 初期対応では、開いた時点で既定選択の `with_descendants` へ focus する
- dialog 内では `ArrowLeft/ArrowRight` で scope 候補を移動し、`Enter` または `Space` で現在候補を確定する
- dialog 内では `Tab / Shift+Tab` で既存 focusable 要素の間を循環し、背景へ focus を逃がさない
- `Escape` では reschedule scope dialog を閉じ、変更は適用しない
- `Escape` または scope 確定で dialog が閉じた後は、開く前に focus していた timeline item へ focus を戻す

### Dependency Type
- MVP は `finish_to_start` のみ
- lagDays を正負整数で持てる
- dependency 作成時は predecessor と successor が同一 project に属している必要がある
- predecessor と successor の自己参照は禁止
- archived item は dependency の端点にできない
- 同一 `predecessor/successor/type` の重複登録は禁止
- dependency 作成時は既存 edge を含む同一 project 内の有向グラフで cycle を作ってはいけない
- direct cycle だけでなく indirect cycle も保存前に拒否する
- `finish_to_start` の営業日対応後は `successor.startDate` を predecessor 終了日から `lagDays + 1` 営業日後以上へ調整する
- scheduled でない successor はこの slice では自動シフトしない
- 初期 dependency editor では selected item を successor とする `finish_to_start` の追加を先に提供し、既存 dependency の削除は predecessor / successor のどちら側からでも行える
- browser mode では dependency editor を read-only note に留める
- 初期 keyboard timeline edit は focused bar / marker に対して `Alt+Left/Right` で移動、`Alt+Shift+Left/Right` で右端リサイズを提供する
- focused timeline bar / marker では `ArrowUp/ArrowDown` で前後の visible timeline item へ focus を移動できる
- milestone は keyboard move のみを対象とし、keyboard resize は task / group の bar に限定する
- reschedule scope dialog を timeline keyboard move から開いた場合、close 後の focus restore は同じ item の bar / marker を優先する

## 3.4 ロールアップ

### 進捗
- 葉タスクは `percentComplete` を直接保持
- グループは子孫葉タスクの重み付き平均
- 重みは `max(durationDays, 1)` を使用
- マイルストーンは 0 or 100

### 状態
- 子に `blocked` が1件でもあれば親候補は `blocked`
- 全子 `done` なら親は `done`
- 一部着手なら `in_progress`
- 子が無ければ自身の状態

### 日付
- 親開始日 = 子の最小開始日
- 親終了日 = 子の最大終了日
- マイルストーンは開始日 = 終了日

## 3.5 Quick Capture パース規則

### 入力例
- `見積提出 4/25`
- `設計レビュー 4/28 15:00 60分`
- `A案件 基本設計 5/1-5/20 #設計 @田中`
- `定例会 毎週月曜 10:00 30分`
- `障害調査 !高 @自分 #運用`

### 解釈順
1. 日付範囲
2. 単日
3. 時刻
4. 所要時間
5. 担当記号 `@`
6. タグ記号 `#`
7. 優先度記号 `!`
8. 残り文字列をタイトル
9. 未解析トークンはメモに保持

## 3.6 エラー処理
- 解析失敗はブロックしない
- Import 失敗は1行単位で分離表示
- DB 書込失敗時は編集中内容を保持
- Export 失敗時は原因と再試行導線を表示

## 3.7 監査ログ（MVP最小）
- 作成日時
- 更新日時
- 完了日時
- 直近変更者（MVPではローカルユーザー名相当）
