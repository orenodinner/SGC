このプロジェクトの差別化要件である **Portfolio view** と **Year/FY Roadmap view** を優先実装して下さい。

実行方針:
- `docs/02-product-requirements.md`
- `docs/03-functional-spec.md`
- `docs/04-ux-spec.md`
- `docs/05-data-model-and-db.md`
を必ず確認してから着手

要求:
- 仕様どおり、複数大規模プロジェクトを横断表示できること
- Project row の progress / overdue / next milestone / risk を出すこと
- 年間表示は月または四半期 bucket で描画すること
- FY 開始月設定を反映すること
- 受け入れ試験 `ACC-009` `ACC-010` `ACC-011` `ACC-012` を意識して実装すること
- UI だけでなく、集計ロジックとテストも入れること

可能なら:
- 集計ロジック
- 表示コンポーネント
- 最低限の E2E
までまとめて入れて下さい
