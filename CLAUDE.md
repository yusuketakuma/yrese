# CLAUDE.md

@AGENTS.md

## Claude lane notes

- agmsg team `yrese` のagent `claude` として動く。codexからのメッセージには受領した旨を
  短く返信する。
- 書き込み前に対象exact pathsをagmsgでcodexへ宣言し、codexが宣言済みのexact pathsと
  active WPのdirty stateには触れない。
- codexが`active_root_writer`のWP進行中は、branch切替・test/build/formatter実行・
  stage/commitを行わず、read-only mapper/reviewerとして動く。current user requestで
  例外が必要な場合も、実行前にagmsgで宣言する。
- 連携ルールの追加・変更はagmsgでの提案と合意の往復後にのみ有効(正本はメッセージ履歴)。
