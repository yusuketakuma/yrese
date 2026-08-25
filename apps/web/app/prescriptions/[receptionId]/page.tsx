import { ErrorNotice } from "../../components/error-notice";
import {
  parsePrescriptionLaunchContext,
  type PrescriptionLaunchSearchParam,
} from "../prescription-launch-context";
import { PrescriptionLaunchRoute } from "../prescription-launch-route";

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
      <section aria-label="処方入力URLエラー">
        <ErrorNotice
          severity="ERROR"
          message="処方入力の開始情報を確認できませんでした。"
          nextAction={`${parsed.reason} 受付画面から対象受付を開き直してください。`}
        />
      </section>
    );
  }

  return <PrescriptionLaunchRoute launch={parsed.context} />;
}
