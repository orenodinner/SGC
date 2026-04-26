# 04 UX Specification

## 4.1 UX の基本思想
- 最初の入力を最短にする
- 日程変更はマウス中心で終わる
- 長期表示でも圧迫感を出さない
- 表示切替よりも情報密度の調整で対応する
- 「あとで整理できる」を残す

## 4.2 主要ビューのテキストワイヤー

### Home / Today
```text
+--------------------------------------------------------------------+
| Quick Capture [ タスクを入力。例: 見積提出 4/25 #営業 @自分 ]       |
+--------------------------------------------------------------------+
| [今日] [期限切れ] [今週] [Inbox] [最近更新]                         |
+----------------------+---------------------------------------------+
| 左ペイン             | 右ペイン                                    |
| - 期限切れ           | 今日のタスクリスト                           |
| - 今日               | ミニタイムライン                              |
| - 今週の予定         | 次マイルストーン                              |
| - Inbox 件数         | 最近更新プロジェクト                          |
+----------------------+---------------------------------------------+
```

- Inbox card には最小編集導線として `プロジェクト割当` と `日付追加` と `タグ追加` を置く
- Inbox card には follow-up 導線として `テンプレート変換` button を置いてよい
- `日付追加` は単日 picker とし、選択時に1日タスクとして計画へ載せる
- `タグ追加` は inline text field とし、blur で自動保存する
- `テンプレート変換` の初期挙動は current Inbox item から draft project を作成し、その item を root row として移したうえで Project Detail を開き、`Templates` panel を自動で開く
- 初期の `テンプレート変換` では専用 modal を増やさず、既存の `Save current project as template` / `Save selected root as template` をそのまま使う
- sidebar 下部には `Data Protection` card を置き、`Backup now` と recent backup list を表示してよい
- sidebar の project list は大量 project でも Gantt / Project Detail を圧迫しないよう、compact row、内部スクロール、検索、折りたたみを備える
- project list の内部スクロールは sidebar 全体の長大スクロールへ波及させず、検索変更時は一覧先頭へ戻して目的 project を見失わないようにする
- `Backup now` 成功時は notice banner に保存先パスを短く表示する
- `Data Protection` card には `Text Git backup` を追加し、SQLite の復元用 backup とは別に current workspace を text artifact として保存できる
- `Text Git backup` 成功時は notice banner に text backup directory と、Git commit できた場合は short commit hash を短く表示する
- Git が利用できない場合でも text file 出力は成功扱いとし、notice には Git commit が未実行である理由を短く表示する
- `Data Protection` card には `自動: 起動時に日次1回 / auto 7件保持` のような policy copy を置いてよい
- recent backup list は `file name / created at / size` の最小情報に留める
- recent backup list では `manual / auto / safety` を file name prefix に応じた小さな label で区別してよい
- recent backup row には `Restore Preview` ボタンを置いてよい
- `Restore Preview` では `file name / created at / size / project count / item count / latest updatedAt` を read-only panel で表示する
- restore preview panel には destructive 操作として `Restore` を置いてよい
- `Restore` 押下後は confirm UI を挟み、desktop では `safety backup を作成してから復元する` ことを明示する
- restore 完了後は notice banner に `restored backup` と `safety backup` の情報を短く表示する
- startup recovery mode では通常の Home / Project Detail の代わりに full-width の recovery screen を表示してよい
- recovery screen には `起動に失敗した` 見出し、error summary、recent backup list、`restore すると通常 workspace へ戻ります` のような next step copy を置く
- recovery screen の recent backup row には `Restore Preview` を置き、preview panel から `Restore` を実行してよい
- recovery screen の `Restore` confirm では `desktop では safety backup を作成してから復元する` ことを明示する
- restore 成功後は recovery screen を抜けて通常 workspace へ戻し、成功 notice を短く表示する

### Project Detail
```text
+------------------------------------------------------------------------------------+
| プロジェクト名 | [日][週][月][Q][年][FY] | Filter | Search | Export | Import      |
+--------------------------------------+---------------------------------------------+
| WBS tree / grid                      | Timeline                                     |
| WBS | 種別 | タイトル | 状態 | ...     | 4/1 4/2 4/3 ...                             |
| 1   | G   | A案件                    | ========                                     |
| 1.1 | T   | 要件定義                 | ====                                         |
| 1.2 | T   | 基本設計                 |   ======                                     |
| 1.3 | M   | 設計完了                 |         ♦                                    |
+--------------------------------------+---------------------------------------------+
| Detail drawer: notes / tags / dependency / recurrence / history                   |
+------------------------------------------------------------------------------------+
```

- Project Detail のガントは日付単位表示に固定し、`日 / 週 / 月` の粒度切替は出さない
- header には `日付単位ガント` と `1日単位` のような表示を置き、操作ヒントも1日移動 / 1日調整として案内する
- 初期実装の `Export` は Project Detail toolbar の `Excel Export` ボタンとして置く
- ボタン押下時は OS の保存ダイアログを開き、既定ファイル名は project code を優先して提案する
- 保存成功時は保存先パスの短い通知を表示し、キャンセル時は何もしない
- 初期実装の `Import` は Project Detail toolbar の `Excel Import` ボタンとして置く
- ボタン押下時は OS のファイル選択ダイアログを開き、選択後は preview panel に `new / update / error` 件数と先頭行一覧を表示する
- 初期 preview panel には `適用` と `閉じる` を置く
- 初期 preview panel には `全件 / warning / error` filter chip を置く
- `warning` では warning を1件以上持つ row、`error` では `action=error` row のみを表示する
- 初期 preview panel の counts の下には dedicated warning summary を置き、warning がある row の `row number / title / warning` を先に一覧できるようにする
- 初期 preview panel の warning summary の下には dedicated warning-only table を置き、warning 行だけを `row / project / title / warning` で本体 table とは別に比較できるようにする
- 初期 preview table の update row には `差分` ボタンを置き、押下時に field / before / after の比較行を inline 展開する
- 差分比較は warning / error 表示と同じ row 内で完結させ、new row と error row には compare toggle を出さない
- browser fallback では `Import` 押下時に browser file picker を開き、preview 後は同じ panel から `適用` を実行できる
- browser fallback の `適用` は preview 済み workbook を current project へ反映し、valid な `DependsOn` も同じ commit で戻す
- `適用` は current project に対して `new / update` 行だけを反映し、`error` 行はそのまま skip する
- 適用成功時は短い通知を出し、Project Detail と Home / Portfolio 集計を再読込する
- error row では summary message に加えて、`列名: 理由` の issue list を同じ row 内に表示する
- warning row では warning chip を同じ row 内に表示する
- `Templates` の first slice は Project Detail toolbar の button から開く panel として置いてよい
- Project Detail toolbar の下には、選択中 project 直下へ task を1件追加できる compact quick-add form を置いてよい
- quick-add form は title だけで送信でき、作成される row は root-level `task` とする
- template panel では `WBS Templates` と `Project Templates` の2 section を分け、保存済み template の `name / updatedAt` と short helper copy を表示する
- `WBS Templates` の row action は `Apply to current project` に限定し、current project root 直下へ subtree を追加する
- `Project Templates` の row action は `Create project` に限定し、新しい project を作成したらその project を選択状態にして Project Detail を開く
- follow-up slice では同じ panel の各 section header に save action を追加してよい
- `WBS Templates` の save action は `Save selected root as template` とし、selected row が root でない時は disabled にして helper copy で理由を示す
- `Project Templates` の save action は `Save current project as template` とし、名前入力 modal は使わず current project 名を既定名として保存する
- save 成功後は panel を開いたままにして新しい template row を一覧の先頭で確認できるようにする
- `TASK-1102` の first slice では detail drawer の既存 grid に recurrence section を追加し、別 modal は作らない
- recurrence section の入力要素は `preset select / next occurrence date / 保存 / 削除` に限定する
- unsupported rule が入っている時は editable form の上に `unsupported rule / generation 対象外` の read-only note を出す
- unscheduled item と group / milestone では recurrence editor の代わりに unavailable note を出す
- `TASK-1202` では recurrence section の同じ場所に cadence builder を追加し、別 modal は作らない
- cadence builder は `Cadence / Interval / Weekday / Month / Month day / Next occurrence` の必要項目だけを表示し、選択した cadence に不要な field は隠す
- unsupported rule が入っている時は read-only note を残しつつ、下の builder から supported / unsupported rule へ再構築して保存できる
- Inbox の `テンプレート変換` はまだ出さず、save/list/apply が揃ってから別導線で追加する
- 最後の follow-up では Inbox の `テンプレート変換` からこの panel を起動できるようにする
- detail drawer の dependency セクションには `先行タスク追加` と `既存 dependency 一覧` を置く
- 初期 dependency editor では selected item を successor とする先行タスクだけを追加できる
- linked dependency 一覧では predecessor / successor の向きを示し、各 row から削除できる
- browser mode では dependency editor の代わりに `desktop only` の informational note を表示する
- scheduled item の timeline bar / marker は focusable にし、focus 時に selected item と同期する
- 初期 keyboard 操作は `Alt+←/→ = move`、`Alt+Shift+←/→ = right edge resize` を hint と aria-label で案内する
- focused timeline item では `↑ / ↓` で前後の visible timeline item へ focus を移し、selected item も追従させる
- keyboard resize は task / group の bar のみを対象にし、milestone marker では move のみ許可する
- item 数が多い場合、Project Detail の WBS と timeline は同じ visible window だけを描画してよい
- 初期 virtualization では row 高さを固定し、top / bottom spacer で scroll continuity を保つ
- virtualization 中も WBS と timeline の縦スクロール同期、selected row の見た目、timeline focus traversal を維持する
- Search / Filter Drawer の initial slice は Project Detail へはまだ接続せず、follow-up で hierarchy 文脈保持と合わせて追加する

### Portfolio
```text
+------------------------------------------------------------------------------------+
| Portfolio | [全案件] [遅延中] [今週マイルストーン] [年表示へ]                      |
+------------------------------------------------------------------------------------+
| 展開 | 名前 | 状態 | 進捗 | 期限超過 | 次マイルストーン | リスク | 更新           |
|  ▸   | A案件 | 進行中 | 64% | 2 | 2026-06-15 | 中 | 2日前                        |
|  ▾   | B案件 | 遅延   | 48% | 7 | 2026-05-02 | 高 | 今日                         |
|      |   1 要件定義 | 進行中 | 55% | 2 | 2026-04-28 | 中 | 3日前                    |
|      |   2 実装     | 遅延   | 5 | 2026-05-02 | 高 | 今日                         |
+------------------------------------------------------------------------------------+
```

- Project row の左端に expand/collapse ボタンを置く
- expand 後は project 直下の主要 phase を indented row として同じ表の中に出す
- Portfolio の初期 filter chip は `全案件 / 遅延中 / 今週マイルストーン`

### Year / FY Roadmap
```text
+------------------------------------------------------------------------------------+
| [年] [FY] [2026] [FY2026] [月表示] [四半期表示] [Portfolio filter]                 |
+------------------------------------------------------------------------------------+
| [全件] [期限超過] [マイルストーン]                                                  |
+------------------------------------------------------------------------------------+
|                     | 2026                            | 2027        |
|                     | Q1      | Q2      | Q3      | Q4      |             |
| 項目                 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 1 | 2 | 3 |
| ▾ A案件              | =======                                                     |
|   └ 基本設計         | ===                                                         |
|     └ API 実装       |    ========                                                 |
|  └ リリース          |            ♦                                                |
| B案件                |   =========                                                 |
+------------------------------------------------------------------------------------+
```

- month header の上に quarter header、その上に西暦 year header を置く
- Year / FY view の quarter は FY 開始月基準で並べ、FY開始月=4 の場合は 4月が Q1、3月が Q4 の終わりになる
- Year / FY Roadmap の先頭には長い説明文を置かず、scale / filter / range / 表示年数の操作をすぐ使える状態にする
- Year / FY Roadmap の roadmap toolbar は1行の compact control strip とし、縦幅を増やさず横スクロールで逃がしてよい
- 月別 workload strip は既定では非表示にし、Settings の `年次FY画面に月別負荷を表示` が有効な場合だけ、西暦 year header の上に数字と色だけの低い1行として表示する
- roadmap の初期 filter chip は `全件 / 期限超過 / マイルストーン`
- roadmap の root-level group row には expand/collapse ボタンを置く
- expand 後は dated descendant を indented row として同じ表の中に出す
- row 数が多い場合、roadmap は quarter header / month header を固定したまま body の visible row だけを描画してよい
- 初期 roadmap virtualization では row 高さを固定し、top / bottom spacer で scroll continuity を保つ
- virtualization 中も filter 切替、expand/collapse、project open の click target を維持する
- Portfolio の `遅延中` は overdue project のみを残し、`今週マイルストーン` は今週内に milestone を持つ project のみを残す

## 4.3 Interaction 設計

### Search / Filter Drawer
- Home / Portfolio / Year-FY Roadmap に加えて Project Detail の project header 直下にも `Search / Filter` button を置いてよい
- drawer には `全文 / プロジェクト / Portfolio / 状態 / 優先度 / タグ / 担当 / 期限超過のみ / マイルストーンのみ / 年間表示対象のみ` を置く
- initial slice の `Portfolio` は `portfolio_id` を free-text で受ける
- initial slice の `Clear` は current view 用の drawer 条件を既定値へ戻す
- active filter は drawer 外にも chip で見せ、current view にだけ効いていることが分かるようにする
- Search / Filter toolbar は inactive helper copy を表示せず、active filter chip は1行横スクロールにして Year / FY Roadmap の縦幅を増やさない
- Portfolio と Roadmap の既存 quick filter chip は drawer 条件と AND で併用してよい
- Project Detail では child row だけが一致した場合でも ancestor row を同時表示し、孤立した child だけを見せない
- Project Detail では WBS と timeline の filtered row window を同じ集合に保つ

### Settings
- sidebar navigation に `Settings` を追加してよい
- first slice の Settings は 1 画面 1 column の軽量 form とし、`週開始曜日 / FY開始月 / 既定表示` だけを編集対象にする
- `週開始曜日` は segmented control または select で `月曜始まり / 日曜始まり` を選べるようにする
- `FY開始月` は 1-12 月の select とする
- follow-up slice の `表示言語` は `日本語 / English` の select または segmented control とし、保存後は sidebar navigation と Settings 自身の文言、主要 view 見出し、主要 action label に即時反映してよい
- 初期の `表示言語` slice では一部の深い詳細文言や domain value の翻訳は placeholder のままでもよいが、ユーザーが切り替わったことを主要導線で確認できることを優先する
- follow-up slice の `稼働日` は `月曜-日曜` の checkbox row とし、1日以上を選ばない状態では保存できないようにする
- `稼働日` helper copy では `dependency 自動後ろ倒しで使用` を短く案内してよい
- follow-up slice の `テーマ` は `ライト / ダーク` の select とし、保存後は shell 背景、sidebar、主要 card、button、input の配色が即時に切り替わるようにする
- 初期の `テーマ` slice では複雑な chart 系や item status color の完全 theme 対応までは要求しない
- `TASK-1203` 以降は status pill、import warning / compare、roadmap / portfolio row、timeline bar / marker / grid も theme token を使い、dark theme で淡色固定の chip や表 header が残らないようにする
- chart 系の色は機能識別を保つため、project / task / group / milestone / marker の意味ごとに token を分ける。ユーザーが色を編集する palette UI はこの slice では追加しない
- `既定表示` は `Home / Portfolio / Year-FY` の radio または select とする
- `TASK-1002` の first slice では `自動バックアップ` を checkbox または switch、`保持件数` を `1-30` の select とする
- `自動バックアップ` を off にした場合でも `Backup now` と recent backup list はそのまま使えるようにする
- sidebar の `Data Protection` card にある policy copy は current settings に合わせて `有効/無効` と保持件数が分かるようにする
- Excel defaults の first slice では `優先度既定値` を select、`担当既定値` を text input とする
- Excel defaults の helper copy では `project export の MasterData に既定ヒントとして出力` を短く案内してよい
- 保存は explicit button を置き、保存成功時は notice banner で短く知らせてよい
- 再起動後も保持されることが分かる短い helper copy を置いてよい
- auto backup は user-facing 設定を提供済みとし、Excel defaults の first slice 以降は placeholder copy に戻さない

### 行操作
- Enter: 新規行
- Tab: 次列
- Shift+Tab: 前列
- Space: 完了切替
- Ctrl+Z: 直前の item 編集を取り消し
- Ctrl+Shift+Z / Ctrl+Y: 取り消した item 編集をやり直し
- Ctrl+[ / Ctrl+]: アウトデント / インデント
- Alt+Left / Right: 1日単位で移動
- Alt+Shift+Left / Right: 右端を1日単位で調整
- ArrowUp / ArrowDown: timeline focus を前後の visible item へ移動

### タイムライン操作
- バー中央ドラッグ: 期間そのまま移動
- 左端ドラッグ: 開始日変更
- 右端ドラッグ: 終了日変更
- ダブルクリック: 完了 / 未完了切替
- Shift+ドラッグ: スナップ無視の微調整（任意）

### リスケ確認
依存や子孫を含む場合のみ、小さなポップオーバーで次を聞く。
- このタスクだけ
- 子も一緒に
- 後続もずらす

既定選択は `with_descendants`。
- 初期実装では、子孫を持つ row の timeline move 時にこのポップオーバーを出す
- dependency を持つ行では `後続もずらす` を選べる
- 初期実装では後続の前倒しは行わず、必要最小限の後ろ倒しのみ行う
- 自動後ろ倒しが土日に当たる場合は、次の営業日へスナップする
- 初期 keyboard 補助では dialog を開いた時点で `子も一緒に` に focus を置く
- `← / →` で候補を移動し、`Enter / Space` で確定する
- `Tab / Shift+Tab` では dialog 内のボタン間だけを循環させ、背景へ focus を逃がさない
- `Escape` で dialog を閉じる
- dialog を閉じた後は、元の timeline bar / marker に focus を戻して操作継続しやすくする

## 4.4 視覚ルール
- 色は状態よりも可読性を優先
- 危険状態のみ強い強調
- 完了は沈める
- 年間表示では色数を絞る
- グリッド線は薄く
- ガントはタスク > マイルストーン > 依存線の順で視線誘導

## 4.5 Empty State
- Inbox 0件: 「今のところ未整理はありません」
- Project 0件: 「Quick Capture か Excel Import から始めて下さい」
- Portfolio 0件: 「まず1つプロジェクトを作成して下さい」
- Year view 0件: 「日付が入った項目を表示します」

## 4.6 フォーム設計
- 保存ボタンを減らす
- destructive 操作だけ確認
- 既定値を多めに入れる
- 高度設定は drawer / accordion 内に隠す

## 4.7 アクセシビリティ最低ライン
- キーボード操作可能
- フォーカス見失い防止
- 色だけで状態を表現しない
- 主要アイコンにはラベル併記

## 4.8 Team / workload usability
- Project Detail の header で `メイン担当` を直接編集できるようにする
- Project Detail は `メイン担当` と task の `担当` を集計し、担当者別 chip に `未完了 / 完了 / 遅延` を表示する
- 担当者 chip は Project Detail の担当者フィルタへ接続し、日程変更対象の task を探しやすくする
- サブタスクが7件前後になる前提で、選択行の下へ1行1タスクの multiline 入力からまとめて追加できる導線を置く
- Portfolio は担当者別の project / 未完了 / 遅延件数を表示し、担当者クリックで該当 project へ絞り込めるようにする
- Year / FY Roadmap は表示中 task を月別に集計した workload strip を出し、年間の山谷を表より先に視認できるようにする

## 4.9 Multi-year roadmap / event day entry
- Year / FY Roadmap の toolbar に `表示年数` slider を置き、1-5年を即時切替できるようにする
- 複数年表示時の range label は `2026年 - 2027年` または `FY2026 - FY2027` のように開始と終了を明示する
- bucket が増えて横幅が広がるため、roadmap panel と workload strip は横スクロール可能にする
- Project Detail の入力導線には、複数サブタスク追加とは別に `イベント日追加` を置く
- イベント日は title と date だけで登録でき、selected row がある場合はその配下、無い場合は project 直下に入る
