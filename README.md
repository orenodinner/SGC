# Simple Gantt Chart (SGC)

Windows で日々の案件・タスク・ガントチャートを軽く管理するための、ローカルファーストなデスクトップアプリです。
Electron / React / TypeScript / SQL.js(SQLite) で実装されており、データは基本的に利用者のPC内に保存されます。

## このアプリでできること

- プロジェクトごとのWBSツリー管理
- タスク、グループ、マイルストーンの作成・編集
- 日 / 週 / 月スケールのガントチャート表示
- タイムライン上でのタスク移動・期間変更
- 子孫タスクや後続依存タスクを含めた日程変更
- Portfolio 画面で複数案件の進捗・遅延・リスクを横断確認
- Year / FY Roadmap で年間・会計年度単位の長期案件を確認
- Quick Capture から雑な入力でInboxまたは既存案件へタスク登録
- Search / Filter Drawer によるプロジェクト・状態・優先度・担当・タグ等の絞り込み
- Excel export / import によるガントデータの往復
- ローカルSQLiteバックアップ、復元プレビュー、復元
- テキスト形式のGitバックアップ
- WBS / Project template の保存・適用
- 繰り返しタスクの保存と一部ルールの次回生成
- 日本語 / 英語の表示切替
- light / dark テーマ切替
- 稼働日、週開始曜日、FY開始月、既定表示、Excel既定値の設定

## 推奨環境

- Windows 10 / 11
- Node.js 20 以降
- npm
- Git

通常利用だけなら、ビルド済み portable artifact を展開して `Launch SGC.cmd` を実行します。
開発や再ビルドを行う場合は Node.js / npm が必要です。

## ビルド済みWindows版の使い方

このリポジトリでは Windows portable zip を生成できます。

```powershell
powershell -ExecutionPolicy Bypass -File scripts\build.ps1
```

生成物:

- `artifacts/sgc-portable-win-x64-v0.1.0.zip`
- `artifacts/sgc-portable-win-x64-v0.1.0/`

利用手順:

1. `artifacts/sgc-portable-win-x64-v0.1.0.zip` を任意の場所へ展開します。
2. 展開先の `Launch SGC.cmd` をダブルクリックします。
3. SGC が起動し、ローカルのユーザーデータ領域にデータを保存します。

注意:

- 現時点では MSI installer / auto updater / code signing は未実装です。
- 更新する場合は、新しい portable folder に差し替える運用です。
- GitHub release への artifact upload は `gh` CLI が無い環境では実行できません。

## 開発環境で起動する

依存関係をインストールします。

```powershell
npm install
```

開発モードで起動します。

```powershell
npm run dev
```

production 相当で起動する場合:

```powershell
npm run build
npm run preview
```

### デモデータを作り直す

UI確認用のダミープロジェクトを整った状態へ戻す場合は、アプリを閉じた状態で次を実行します。

```powershell
npm run reset:demo
```

既存のSQLiteは `backups/sgc-demo-reset-backup-*.sqlite` に退避され、2026年内の8プロジェクト、各7サブタスク、各プロジェクト2〜3名担当＋メイン担当のデモデータに入れ替わります。

## よく使うコマンド

```powershell
npm run typecheck
npm run lint
npm run test
npm run build
npm run test:e2e
```

用途:

- `npm run typecheck`: TypeScript の型検査
- `npm run lint`: ESLint
- `npm run test`: Vitest による unit / service / domain test
- `npm run build`: Electron main と renderer の production build
- `npm run test:e2e`: build 後に Playwright desktop E2E を実行

## 基本的な使い方

### 1. プロジェクトを作る

左側の入力欄にプロジェクト名とコードを入力し、`プロジェクト作成` を押します。
作成後はProject Detail画面に入り、WBS行とタイムラインを編集できます。

### 2. タスクを追加する

Project Detailで行を追加し、タスク名、種類、状態、優先度、担当、日付、進捗などを編集します。
タスクはWBSツリーとして並び、親子関係に応じてWBSコードが再計算されます。

### 3. ガントチャートを操作する

タイムライン上のバーをドラッグすると日程を移動できます。
右端のリサイズ操作で期間変更できます。
日程変更時には、単体のみ、子孫も同時移動、後続依存タスクも移動といった範囲を選べます。

### 4. Inbox / Quick Capture を使う

Home画面からQuick Captureに入力すると、日付・タグ・担当・プロジェクト名などを簡易解析してタスク化します。
未整理のものはInboxに残り、あとから既存プロジェクトへ移動できます。

### 5. Portfolio / Roadmap を見る

Portfolioでは複数案件の進捗、遅延、次のマイルストーン、リスクを一覧できます。
Year / FY Roadmapでは年単位または会計年度単位で、案件や主要タスクの長期配置を確認できます。

## Excel round-trip

Project DetailのtoolbarからExcel export / importを利用できます。

exportされる workbook は次の4 sheet 構成です。

- `Dashboard`
- `Tasks`
- `Gantt_View`
- `MasterData`

主な用途:

- SGCのタスク一覧をExcelで確認する
- `Tasks` sheetを編集してSGCへ戻す
- `DependsOn` で依存関係を往復する
- warning / error previewで取り込み前に差分を確認する

import時の注意:

- current project と `ProjectCode / ProjectName` が一致しない行はerrorになります。
- 不明な `ParentRecordId` や不正な `DependsOn` はerrorになります。
- 古いworkbookからの更新やcycleの可能性はwarningとして表示されます。
- 初期実装ではrollback専用UIは未実装です。必要なら取り込み前にバックアップを作成してください。

## バックアップと復元

SGCには2種類のバックアップがあります。

### SQLiteバックアップ

`Data Protection` card の `Backup now` で、現在のSQLite DBをtimestamp付きファイルとして退避します。
recent backup listから `Restore Preview` を開くと、復元前に件数や更新日時を確認できます。

復元時の挙動:

- 復元前に `safety backup` を自動作成します。
- 選択したbackupの内容でcurrent DBを置き換えます。
- 復元後にアプリ状態を再読込します。

自動バックアップ:

- 起動時にlocal dayあたり1回だけ `sgc-auto-backup-*` を作成します。
- auto backupは設定された保持件数だけ残します。
- manual backup と safety backup はauto retentionでは削除されません。
- Settingsから自動バックアップの有効/無効と保持件数を変更できます。

### Text Git backup

`Data Protection` card の `Text Git backup` で、ガントチャートやタスク等のデータをテキスト形式で保存します。

出力先:

- アプリデータ領域の `text-backup-git`

出力される主なファイル:

- `manifest.json`
- `projects.json`
- `items.json`
- `dependencies.json`
- `tags.json`
- `item_tags.json`
- `recurrence_rules.json`
- `templates.json`
- `settings.json`
- `projects/*.md`

Gitが利用可能な場合:

- `text-backup-git` がGit repositoryとして初期化されます。
- snapshotごとにcommitされます。
- noticeにshort commit hashが表示されます。

Gitが利用できない場合:

- テキストファイルの出力は成功扱いです。
- Git commitできなかった理由がnoticeに表示されます。

Text Git backupは監査・差分確認・手動復旧のためのartifactです。
正式な復元のsource of truthは引き続きSQLiteバックアップです。

## 設定

Settings画面で次の項目を変更できます。

- 表示言語: `ja / en`
- テーマ: `light / dark`
- 自動バックアップ: 有効 / 無効
- 自動バックアップ保持件数: `1-30`
- Excelテンプレート既定値: 優先度 / 担当
- 週開始曜日: 月曜 / 日曜
- FY開始月
- 稼働日
- 既定表示: Home / Portfolio / Year-FY Roadmap

設定はアプリ内DBに保存され、再起動後も保持されます。

## テンプレート

Project Detailの `Templates` panel から次を実行できます。

- 現在のプロジェクトをproject templateとして保存
- 選択したroot row配下をWBS templateとして保存
- WBS templateを現在のprojectへ適用
- Project templateから新しいprojectを作成

Inboxの `テンプレート変換` では、Inbox itemをroot rowにしたdraft projectを作り、既存のtemplate保存導線へ接続します。

## 繰り返しタスク

Detail drawerでscheduled taskにrecurrence ruleを設定できます。

対応済み:

- weekly
- monthly
- weekdays
- weeklyの任意曜日 / interval
- monthlyの日付指定 / interval
- yearlyの保存専用rule

注意:

- generation対象は既存MVPが対応しているruleに限定されます。
- unsupported ruleは保存できますが、generation対象外であることがUIに表示されます。
- background schedulerや複数件先行生成は未実装です。

## データ保存場所

SGCはlocal-firstです。
SQLite DB、SQLite backup、Text Git backupはユーザーのローカルアプリデータ領域に保存されます。

portable artifact自体を差し替えても、通常はユーザーデータ領域のDBは残ります。
ただし、重要な更新やimport前には `Backup now` と `Text Git backup` の両方を実行しておくことを推奨します。

## リポジトリ構成

```text
.
├─ src/
│  ├─ main/             Electron main process / IPC / workspace service
│  ├─ preload/          Rendererへ公開する安全なAPI
│  ├─ renderer/         React UI / store / browser fallback
│  ├─ infra/            SQLite / Excel I/O
│  ├─ domain/           日付、WBS、依存関係、recurrence等のdomain logic
│  └─ shared/           IPC契約 / Zod schema / TypeScript型
├─ docs/                仕様、UX、DB、計画、受け入れ試験、判断記録
├─ e2e/                 Playwright desktop E2E
├─ scripts/             build script
├─ spec/                artifact contract / acceptance contract
├─ artifacts/           portable build output
└─ PROJECT_STATUS.md    現在の進捗・blocker・既知リスク
```

## 開発ルール

このリポジトリでは、仕様の一次ソースは `docs/` と `spec/` です。
実装・修正時は `AGENTS.md` の手順に従い、必要に応じて次を更新します。

- `PROJECT_STATUS.md`
- `docs/backlog.yaml`
- `docs/decisions.yaml`
- 該当する仕様書
- 該当するテスト

変更後は、少なくとも関連する `typecheck / lint / test / build / E2E` の妥当なsubsetを実行してください。

## 現在の既知blocker

GitHub release asset upload は未完了です。
Windows portable zip自体は生成できますが、この環境では `gh` CLI がPATH上に無いため、releaseへのasset uploadができません。

現時点の生成済みartifact:

- `artifacts/sgc-portable-win-x64-v0.1.0.zip`

## ライセンス

このリポジトリにはまだ明示的なライセンスファイルはありません。
外部配布前に `LICENSE` の追加と配布ポリシーの確定が必要です。
