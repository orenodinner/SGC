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
- `日付追加` は単日 picker とし、選択時に1日タスクとして計画へ載せる
- `タグ追加` は inline text field とし、blur で自動保存する

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
- browser fallback では `Import` 押下時に browser file picker を開き、preview 後は同じ panel から `適用` を実行できる
- browser fallback の `適用` は preview 済み workbook を current project へ反映し、初期 slice では dependency import は行わない
- browser fallback の preview panel には `DependsOn は適用されない` ことを示す informational note を置く
- `適用` は current project に対して `new / update` 行だけを反映し、`error` 行はそのまま skip する
- 適用成功時は短い通知を出し、Project Detail と Home / Portfolio 集計を再読込する
- error row では summary message に加えて、`列名: 理由` の issue list を同じ row 内に表示する
- warning row では warning chip を同じ row 内に表示する
- detail drawer の dependency セクションには `先行タスク追加` と `既存 dependency 一覧` を置く
- 初期 dependency editor では selected item を successor とする先行タスクだけを追加できる
- linked dependency 一覧では predecessor / successor の向きを示し、各 row から削除できる
- browser mode では dependency editor の代わりに `desktop only` の informational note を表示する
- scheduled item の timeline bar / marker は focusable にし、focus 時に selected item と同期する
- 初期 keyboard 操作は `Alt+←/→ = move`、`Alt+Shift+←/→ = right edge resize` を hint と aria-label で案内する
- keyboard resize は task / group の bar のみを対象にし、milestone marker では move のみ許可する

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
|                     | Q1      | Q2      | Q3      | Q4      |                      |
| 項目                 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 1 | 2 | 3         |
| ▾ A案件              | =======                                                     |
|   └ 基本設計         | ===                                                         |
|     └ API 実装       |    ========                                                 |
|  └ リリース          |            ♦                                                |
| B案件                |   =========                                                 |
+------------------------------------------------------------------------------------+
```

- month header の上に quarter header を置く
- FY view の quarter は FY 開始月基準で並べる
- roadmap の初期 filter chip は `全件 / 期限超過 / マイルストーン`
- roadmap の root-level group row には expand/collapse ボタンを置く
- expand 後は dated descendant を indented row として同じ表の中に出す
- Portfolio の `遅延中` は overdue project のみを残し、`今週マイルストーン` は今週内に milestone を持つ project のみを残す

## 4.3 Interaction 設計

### 行操作
- Enter: 新規行
- Tab: 次列
- Shift+Tab: 前列
- Space: 完了切替
- Ctrl+Z: 直前の item 編集を取り消し
- Ctrl+Shift+Z / Ctrl+Y: 取り消した item 編集をやり直し
- Ctrl+[ / Ctrl+]: アウトデント / インデント
- Alt+Shift+Left / Right: 1日単位で移動

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
