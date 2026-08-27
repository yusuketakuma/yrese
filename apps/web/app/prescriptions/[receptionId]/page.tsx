import Link from "next/link";

import { ErrorNotice } from "../../components/error-notice";
import {
  OperatorPage,
  Panel,
  ScreenHeader,
  StatusPill,
} from "../../components/operator-ui";
import {
  parsePrescriptionLaunchContext,
  type PrescriptionLaunchSearchParam,
} from "../prescription-launch-context";
import {
  PrescriptionLaunchGateRail,
  PrescriptionLaunchRoute,
} from "../prescription-launch-route";

type PrescriptionRouteSearchParams = {
  readonly date?: PrescriptionLaunchSearchParam;
};

export default async function Page({
  params,
  searchParams,
}: {
  readonly params: Promise<{ readonly receptionId: string }>;
  readonly searchParams: Promise<PrescriptionRouteSearchParams>;
}) {
  const [{ receptionId }, query] = await Promise.all([params, searchParams]);
  const parsed = parsePrescriptionLaunchContext({
    receptionId,
    date: query.date,
  });

  if (parsed.status === "invalid") {
    return (
      <OperatorPage
        rail={<PrescriptionLaunchGateRail />}
        railLabel="処方入力の前提と安全情報"
      >
        <ScreenHeader
          title="受付スコープ処方入力"
          eyebrow="SCR-004 受付スコープ"
          description="URLの受付ID・業務日を検証できるまで処方入力を開始しません。"
          meta={<StatusPill tone="danger">URL不正・開始不可</StatusPill>}
        />
        <section aria-label="処方入力URLエラー">
          <Panel title="この URL から処方入力を開始できません">
            <ErrorNotice
              severity="ERROR"
              message="処方入力の開始情報を確認できませんでした。"
              nextAction={`${parsed.reason} 受付ダッシュボードから該当の受付を選び直してください。URLの受付IDを手入力しないでください。`}
            />
            <p>
              <Link className="operator-button" href="/">
                受付ダッシュボードへ戻る
              </Link>
            </p>
          </Panel>
        </section>
      </OperatorPage>
    );
  }

  return <PrescriptionLaunchRoute launch={parsed.context} />;
}
