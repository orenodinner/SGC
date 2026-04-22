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
- browser fallback では file picker から `.xlsx` を選んで preview を出し、そのまま current project へ commit できる
- browser fallback の preview panel では `DependsOn` は preview/validation のみで apply 時は反映しないことを明示する
- browser fallback の初期 import は SGC export が出す store-only workbook を主対象とする
- browser fallback の初期 commit は preview 済み workbook を browser memory 上の current project へ apply する
- browser fallback の初期 commit は canonical `Tasks` の基本編集列と `Tags / ParentRecordId` までを対象とし、`DependsOn` は apply しない
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
- milestone は keyboard move のみを対象とし、keyboard resize は task / group の bar に限定する

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
