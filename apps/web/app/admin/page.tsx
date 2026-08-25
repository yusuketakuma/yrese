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

export default function Page() {
  return (
    <section data-operational-data="unavailable" aria-label="管理・設定">
      <OperatorPage
        railLabel="管理・設定の補助情報"
        rail={
          <>
            <RailCard title="組織情報" tone="warning">
              <StatusPill tone="warning">組織API未接続</StatusPill>
              <p className="rail-muted">
                薬局名、住所、薬局コード、保険薬局番号は未取得です。
              </p>
              <PrototypeAction reason="組織情報APIと権限判定が未接続">
                組織情報を管理
              </PrototypeAction>
            </RailCard>
            <RailCard title="セキュリティ状態" tone="warning">
              <StatusPill tone="warning">認証監査API未接続</StatusPill>
              <p className="rail-muted">
                弱い認証情報、MFA未設定、休眠アカウントの件数は判定できません。0件を意味しません。
              </p>
            </RailCard>
            <RailCard title="バックアップ・同期" tone="warning">
              <StatusPill tone="warning">未接続</StatusPill>
              <p className="rail-muted">
                バックアップ時刻・成功状態・復元可否は未取得です。
              </p>
            </RailCard>
            <RailCard title="運用時の確認事項">
              <ul className="rail-action-list">
                <li>権限の定期レビュー</li>
                <li>監査ログの定期確認</li>
                <li>帳票テンプレート差分確認</li>
              </ul>
            </RailCard>
          </>
        }
      >
        <ScreenHeader
          title="管理・設定"
          description="ユーザー、ロール、薬局基本情報、帳票、監査ログ、端末設定を管理します。"
          meta={<StatusPill tone="danger">permission_scope_registry承認待ち</StatusPill>}
        />
        <PrototypeBanner>
          ユーザー・権限・組織・セッション・バックアップ・端末の運用データは未取得です。作成・変更・失効・権限付与は実行されません。
        </PrototypeBanner>
        <MetricGrid>
          <MetricCard label="ユーザー" value="—" unit="名" detail="ユーザーAPI未接続" tone="neutral" icon="人" />
          <MetricCard label="ロール" value="—" unit="件" detail="ロールAPI未接続" tone="neutral" icon="盾" />
          <MetricCard label="アクティブセッション" value="—" unit="件" detail="0件を意味しません" tone="neutral" icon="端" />
          <MetricCard label="承認待ち" value="—" unit="件" detail="0件を意味しません" tone="neutral" icon="?" />
        </MetricGrid>

        <div className="operator-two-column admin-grid">
          <div className="operator-stack">
            <Panel
              title="ユーザー管理"
              actions={
                <PrototypeAction reason="ユーザーAPIと権限判定が未接続">
                  新規ユーザー追加
                </PrototypeAction>
              }
            >
              <div className="table-scroll" tabIndex={0} aria-label="ユーザー一覧表">
                <table className="operator-table operator-table-dense">
                  <caption className="visually-hidden">未接続のユーザー一覧</caption>
                  <thead>
                    <tr>
                      <th scope="col">氏名</th>
                      <th scope="col">ロール</th>
                      <th scope="col">所属</th>
                      <th scope="col">状態</th>
                      <th scope="col">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td colSpan={5} className="operator-empty-copy">
                        ユーザー一覧API未接続のため表示できません。ユーザー0名を意味しません。
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Panel>
            <Panel title="システム設定" description="設定保存API未接続。表示は予定項目です。">
              <div className="settings-list">
                {[
                  ["自動保存", "入力中の内容を自動的に一時保存"],
                  ["同時編集の警告", "同一データの同時編集を検知して警告"],
                  ["セッションタイムアウト", "一定時間操作がない場合に自動ログアウト"],
                  ["日次バックアップ", "バックアップ実行状態は未接続"],
                ].map(([title, description]) => (
                  <label key={title}>
                    <span><strong>{title}</strong><small>{description}</small></span>
                    <input type="checkbox" disabled />
                  </label>
                ))}
              </div>
            </Panel>
          </div>
          <div className="operator-stack">
            <Panel title="権限設定" description="ロール作成・編集・権限割当は未接続です。"><PrototypeAction reason="permission_scope_registryと権限API未接続">権限を編集</PrototypeAction></Panel>
            <Panel title="薬局基本情報" description="薬局の基本情報、保険情報、口座情報を管理する予定です。"><PrototypeAction reason="組織情報API未接続">基本情報を編集</PrototypeAction></Panel>
            <Panel title="帳票設定" description="表示項目、出力形式、テンプレートを管理する予定です。"><PrototypeAction reason="帳票設定API未接続">帳票設定を開く</PrototypeAction></Panel>
            <Panel title="監査ログ" description="操作・データ変更履歴の閲覧UI。"><PrototypeAction reason="監査ログ閲覧権限とAPI未接続">監査ログを表示</PrototypeAction></Panel>
            <Panel title="デバイス設定" description="端末の利用制限、信頼済み端末を管理する予定です。"><PrototypeAction reason="端末管理API未接続">デバイス設定を開く</PrototypeAction></Panel>
          </div>
        </div>
      </OperatorPage>
    </section>
  );
}
