# 06 Excel Round-trip Contract

## 6.1 目的
Excel は「共有」「印刷」「一時編集」「既存運用との接続」に不可欠。  
したがって export だけでなく **round-trip** を成立させる。

## 6.2 Workbook 構成
- `Dashboard`
- `Tasks`
- `Gantt_View`
- `MasterData`

初期実装では、まず workbook の sheet 順序、`Tasks` シートの列順序、`DependsOn` の文字列表現を pure TypeScript の contract として固定し、その後に `.xlsx` writer を接続する。

## 6.3 Canonical Sheet
- 再取込に使う canonical sheet は `Tasks`
- `Gantt_View` は人間向け
- `Dashboard` はサマリ向け
- `MasterData` は選択肢一覧と注意事項
- `MasterData` には enum 値と注意事項に加えて、Settings の Excel defaults を `Default` category として含めてよい

## 6.4 Tasks シート列定義

| 列名 | 必須 | 例 | 説明 |
|---|---|---|---|
| RecordId | 任意 | itm_001 | 既存更新用の内部ID |
| WorkspaceCode | 任意 | default | 複数WS将来拡張用 |
| PortfolioCode | 任意 | PF-A | Portfolio 識別 |
| PortfolioName | 任意 | 基幹案件群 | 表示名 |
| ProjectCode | 任意 | PRJ-A | Project 識別 |
| ProjectName | 必須 | A案件 | 表示名 |
| ParentRecordId | 任意 | itm_000 | 親ID |
| WbsCode | 任意 | 1.2.3 | 参考表示。import 時は再計算可能 |
| ItemType | 必須 | task | group/task/milestone |
| Title | 必須 | 基本設計 | タイトル |
| Status | 任意 | in_progress | not_started/in_progress/blocked/done/archived |
| Priority | 任意 | high | low/medium/high/critical |
| Assignee | 任意 | 田中 | 担当 |
| StartDate | 任意 | 2026-04-01 | 開始日 |
| EndDate | 任意 | 2026-04-10 | 終了日 |
| DueDate | 任意 | 2026-04-10 | 補助期限 |
| DurationDays | 任意 | 7 | 期間日数 |
| PercentComplete | 任意 | 40 | 0-100 |
| DependsOn | 任意 | itm_101,itm_102+2 | predecessor IDs と lag |
| Tags | 任意 | 設計,重要 | カンマ区切り |
| EstimateHours | 任意 | 16 | 見積時間 |
| ActualHours | 任意 | 8 | 実績時間 |
| Note | 任意 | xxx | 備考 |
| SortOrder | 任意 | 120 | 並び順補助 |
| IsArchived | 任意 | FALSE | 論理アーカイブ |
| LastModifiedAt | 任意 | 2026-04-21T10:00:00 | 競合判断補助 |

## 6.5 Import ルール

### 新規作成
- `RecordId` が空で `ProjectName` と `Title` があれば新規作成
- `ProjectCode` が無く `ProjectName` のみなら、同名プロジェクトを再利用。無ければ新規作成
- `RecordId` が `tmp_` で始まり既存 item に一致しない場合も workbook-local temporary ID を持つ新規行として扱ってよい

### 更新
- `RecordId` が既存 item に一致すれば更新
- `RecordId` が project に対応する行は扱わない。item 行のみ更新対象
- current project import では `ProjectCode` / `ProjectName` が import target と一致しない行を error とする

### 階層化
- `ParentRecordId` があればそれを優先
- 無ければ `WbsCode` を参考にできるが、MVP では `ParentRecordId` を正として扱う
- `ParentRecordId` が不正ならエラー行として隔離

### 日付
- `StartDate` と `EndDate` があれば優先
- `DurationDays` のみある場合は既存開始日を使う。無ければ unscheduled
- milestone は `StartDate == EndDate`

### 依存
- `DependsOn` 形式:
  - `itm_101`
  - `itm_101+2`
  - `itm_101,itm_102-1`
- MVP は Finish-to-Start のみ
- preview validation では token ごとに current project 内の既知 `RecordId` を参照していることを確認する
- preview validation では token ごとに current project 内の既知 `RecordId` または同一 workbook 内で一意な `tmp_*` temporary ID を参照していることを確認する
- current row 自身を指す `DependsOn` は error とする
- preview validation では current project の既存 dependency graph に import row の `DependsOn` を当て込んだとき cycle を作る場合、warning を出す
- 初期 commit では preview を通過した `DependsOn` を successor 単位で置き換えて保存する
- 初期 commit では `tmp_*` temporary ID を同一 import で作成された item の実 ID へ解決してから dependency を保存する

## 6.6 Export ルール
- すべて UTF-8 相当の文字を保持
- 日付は ISO 形式
- `RecordId` は hidden ではなく表示してよい
- `Gantt_View` は印刷向けに列を絞る
- 現在のフィルタを反映して export できる
- workbook の sheet 順序は `Dashboard -> Tasks -> Gantt_View -> MasterData` とする
- 現時点で独立した portfolio entity は未実装のため、`PortfolioCode` と `PortfolioName` は空文字で export してよい
- 初期 writer では `Tasks` を完全出力し、`Dashboard` は project summary、`Gantt_View` は日程確認向けの軽量一覧、`MasterData` は enum 値と import 注意事項の scaffold を出力する
- Settings の Excel defaults を持つ場合、`MasterData` の `Default` category に `Priority` と `Assignee` の既定値を 1 行ずつ出力してよい

## 6.7 Validation
- 必須欠損
- 不正日付
- 循環親子
- 循環依存
- project 不明
- item type 不正
- percent > 100 or < 0
- `DependsOn` token format 不正
- `DependsOn` の current project 外参照 / 不明参照 / 自己参照
- workbook 内で重複した `tmp_*` temporary ID
- `DependsOn` の import 後 graph が cycle になる preview warning

## 6.8 Dry Run
import 実行前に下記件数を表示する。
- new
- update
- skip
- error

## 6.9 競合ポリシー
- MVP はローカル単一ユーザー前提なので楽観更新
- `LastModifiedAt` が既存より古い場合のみ警告表示
- 自動マージはしない

## 6.10 今後拡張
- Excel テンプレート出力
- 色・条件付き書式
- 祝日カレンダーシート
- マクロ不要運用

## 6.11 Roadmap visual export
- Year / FY Roadmap から出力する複数年 workbook は、round-trip import の対象ではなく共有 / 印刷用の visual export とする
- sheet は `Roadmap_Gantt` と `Roadmap_Data` を持つ
- `Roadmap_Gantt` は project / WBS / kind / type / title / assignee / status / start / end / progress の後ろに表示範囲分の月列を並べる
- 月列は表示中の month bucket と同じ順序にし、複数年では `2026/4` から `2028/3` のように年月ラベルを保持する
- project row は青、task row は緑、done row はグレー、milestone は対象月に `◆` を置く
- `Roadmap_Data` は scale、anchor year、year span、range label、generatedAt、row count、month count を記録する
- この workbook は current Roadmap view の filter / expand 状態を反映してよいが、`Tasks` canonical sheet を持たないため import / round-trip には使わない
