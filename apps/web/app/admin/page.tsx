import {
  MetricCard,
  MetricGrid,
  OperatorPage,
  Panel,
  PrototypeAction,
  PrototypeBanner,
  RailCard,
  ScreenHeader,
  StatusPill,
} from "../components/operator-ui";

const USERS = [
  ["合成ユーザーA", "管理者", "総合店", "アクティブ"],
  ["合成ユーザーB", "薬剤師", "総合店", "アクティブ"],
  ["合成ユーザーC", "事務", "総合店", "アクティブ"],
  ["合成ユーザーD", "薬剤師", "分店", "アクティブ"],
  ["合成ユーザーE", "事務", "分店", "休止中"],
] as const;

export default function Page() {
  return (
    <OperatorPage
      rail={
        <>
          <RailCard title="組織情報">
            <p><strong>合成薬局 総合店</strong></p>
            <p className="rail-muted">住所・薬局コード・保険薬局番号はUI合成例です。</p>
            <PrototypeAction>組織情報を管理</PrototypeAction>
          </RailCard>
          <RailCard title="セキュリティのお知らせ" tone="danger">
            <ul className="rail-action-list"><li>弱いパスワード候補：合成例 2件</li><li>多要素認証未設定：合成例 3件</li></ul>
          </RailCard>
          <RailCard title="バックアップ・同期" tone="warning">
            <StatusPill tone="warning">未接続</StatusPill>
            <p className="rail-muted">バックアップ時刻・成功状態・復元可否はインフラ接続後に表示します。</p>
          </RailCard>
          <RailCard title="システムからの提案">
            <ul className="rail-action-list"><li>権限の定期レビュー</li><li>監査ログの定期確認</li><li>帳票テンプレート差分確認</li></ul>
          </RailCard>
        </>
      }
    >
      <ScreenHeader
        title="管理・設定"
        description="ユーザー、ロール、薬局基本情報、帳票、監査ログ、端末設定を管理します。"
        meta={<StatusPill tone="danger">permission_scope_registry承認待ち</StatusPill>}
      />
      <PrototypeBanner tone="danger">
        ユーザー・権限・組織・バックアップ・端末情報は合成例です。作成・変更・失効・権限付与は実行されません。
      </PrototypeBanner>
      <MetricGrid>
        <MetricCard label="ユーザー" value="18" unit="名" detail="合成例" tone="accent" icon="人" />
        <MetricCard label="ロール" value="6" unit="件" detail="合成例" tone="info" icon="盾" />
        <MetricCard label="アクティブセッション" value="7" unit="件" detail="合成例" tone="success" icon="端" />
        <MetricCard label="承認待ち" value="3" unit="件" detail="合成例" tone="warning" icon="時" />
      </MetricGrid>

      <div className="operator-two-column admin-grid">
        <div className="operator-stack">
          <Panel title="ユーザー管理" actions={<PrototypeAction>新規ユーザー追加</PrototypeAction>}>
            <div className="table-scroll"><table className="operator-table operator-table-dense"><thead><tr><th>氏名</th><th>ロール</th><th>所属</th><th>状態</th><th>操作</th></tr></thead><tbody>
              {USERS.map((row) => <tr key={row[0]}><td>{row[0]}</td><td>{row[1]}</td><td>{row[2]}</td><td><StatusPill tone={row[3] === "アクティブ" ? "success" : "neutral"}>{row[3]}</StatusPill></td><td><PrototypeAction>編集</PrototypeAction></td></tr>)}
            </tbody></table></div>
          </Panel>
          <Panel title="システム設定" description="設定保存API未接続。">
            <div className="settings-list">
              {[
                ["自動保存", "入力中の内容を自動的に一時保存"],
                ["同時編集の警告", "同一データの同時編集を検知して警告"],
                ["セッションタイムアウト", "一定時間操作がない場合に自動ログアウト"],
                ["日次バックアップ", "バックアップ実行状態は未接続"],
              ].map(([title, description]) => <label key={title}><span><strong>{title}</strong><small>{description}</small></span><input type="checkbox" disabled /></label>)}
            </div>
          </Panel>
        </div>
        <div className="operator-stack">
          <Panel title="権限設定" description="ロール作成・編集・権限割当は未接続です。"><PrototypeAction>権限を編集</PrototypeAction></Panel>
          <Panel title="薬局基本情報" description="薬局の基本情報、保険情報、口座情報を管理する予定です。"><PrototypeAction>基本情報を編集</PrototypeAction></Panel>
          <Panel title="帳票設定" description="表示項目、出力形式、テンプレートを管理する予定です。"><PrototypeAction>帳票設定を開く</PrototypeAction></Panel>
          <Panel title="監査ログ" description="操作・データ変更履歴の閲覧UI。"><PrototypeAction>監査ログを表示</PrototypeAction></Panel>
          <Panel title="デバイス設定" description="端末の利用制限、信頼済み端末を管理する予定です。"><PrototypeAction>デバイス設定を開く</PrototypeAction></Panel>
        </div>
      </div>
    </OperatorPage>
  );
}
