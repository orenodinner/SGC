この automation は夜間に実行されます。

やること:
1. `PROJECT_STATUS.md` と `docs/backlog.yaml` を読む
2. 最優先の未完了スライスを1つ選ぶ
3. そのスライスを実装する
4. relevant tests を実行する
5. 問題がなければ状態更新
6. 何も進められない場合のみ blocker を簡潔に残す

重要:
- user clarification を待たない
- 仕様不明は既定値で埋める
- 差分は review しやすいサイズに留める
