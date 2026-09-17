import {
  masterMedicationsResponseSchema,
  masterUsagesResponseSchema,
  type MasterMedicationsResponse,
  type MasterUsagesResponse,
} from "@yrese/contracts";
import { permissionScope } from "@yrese/shared-kernel";

import { resolveWebApiUrl } from "../api-transport";
import { devTenantHeaders } from "../dev-tenant";

const READ_SCOPES = [permissionScope("master", "read")] as const;

export class MasterLookupError extends Error {
  constructor(
    readonly kind: "INVALID_RESPONSE" | "UNAVAILABLE",
    message: string,
  ) {
    super(message);
    this.name = "MasterLookupError";
  }
}

/** master 参照名 hydrate が draft 読込/保存を無期限に止めないための上限。 */
export const MASTER_LOOKUP_TIMEOUT_MS = 10_000;

function masterLookupSignal(
  callerSignal: AbortSignal | undefined,
  timeoutMs: number,
): AbortSignal {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  return callerSignal === undefined
    ? timeoutSignal
    : AbortSignal.any([callerSignal, timeoutSignal]);
}

/**
 * MST-003: master 検索は明示 asOf。サーバー側は q 前方一致(localCode)/
 * 部分一致(name・text)を行い、版が存在しない場合は空応答を返す。
 */
async function loadMasterItems(
  path: string,
  asOf: string,
  q: string,
  fetchImpl: typeof fetch,
  signal?: AbortSignal,
  timeoutMs: number = MASTER_LOOKUP_TIMEOUT_MS,
): Promise<unknown> {
  const query = new URLSearchParams({ asOf });
  const trimmed = q.trim();
  if (trimmed.length > 0) query.set("q", trimmed);
  const requestSignal = masterLookupSignal(signal, timeoutMs);
  let response: Response;
  try {
    response = await fetchImpl(
      `${resolveWebApiUrl(path)}?${query.toString()}`,
      {
        headers: devTenantHeaders(READ_SCOPES),
        cache: "no-store",
        signal: requestSignal,
      },
    );
  } catch (error) {
    if (signal?.aborted === true) throw error;
    throw new MasterLookupError(
      "UNAVAILABLE",
      "マスターAPIへ接続できませんでした。",
    );
  }
  if (!response.ok) {
    throw new MasterLookupError(
      "UNAVAILABLE",
      "マスターAPIを利用できませんでした。",
    );
  }
  try {
    return await response.json();
  } catch {
    throw new MasterLookupError(
      "INVALID_RESPONSE",
      "マスターAPIの応答形式が不正です。",
    );
  }
}

export async function searchMasterMedications(
  input: { readonly asOf: string; readonly q: string },
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<MasterMedicationsResponse> {
  const raw = await loadMasterItems(
    "/masters/medications",
    input.asOf,
    input.q,
    fetchImpl,
    signal,
  );
  try {
    return masterMedicationsResponseSchema.parse(raw);
  } catch {
    throw new MasterLookupError(
      "INVALID_RESPONSE",
      "マスターAPIの応答形式を検証できませんでした。",
    );
  }
}

export async function searchMasterUsages(
  input: { readonly asOf: string; readonly q: string },
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<MasterUsagesResponse> {
  const raw = await loadMasterItems(
    "/masters/usages",
    input.asOf,
    input.q,
    fetchImpl,
    signal,
  );
  try {
    return masterUsagesResponseSchema.parse(raw);
  } catch {
    throw new MasterLookupError(
      "INVALID_RESPONSE",
      "マスターAPIの応答形式を検証できませんでした。",
    );
  }
}

/**
 * 読み込み済み draft の resolved 参照を表示名へ解決する。
 * master は append-only で ID は版内で不変。解決不能な ID は
 * 呼出側が「解決済み(ID)」表示へ退ける。
 */
export async function resolveMasterItemLabels(
  input: {
    readonly asOf: string;
    readonly medicationRefs: readonly {
      readonly masterVersionId: string;
      readonly medicationItemId: string;
    }[];
    readonly usageItemIds: readonly string[];
  },
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<{
  readonly medications: ReadonlyMap<string, string>;
  readonly medicationVersionId: string | null;
  readonly usages: ReadonlyMap<string, string>;
}> {
  const medications = new Map<string, string>();
  const usages = new Map<string, string>();
  let medicationVersionId: string | null = null;
  if (input.medicationRefs.length > 0) {
    const response = await searchMasterMedications(
      { asOf: input.asOf, q: "" },
      fetchImpl,
      signal,
    );
    // resolved 参照が保持する版と asOf 解決版が一致するときのみ表示名を採用
    // (版違いの誤表示を防ぐ。wire 参照自体は不変)。
    if (
      response.masterVersion !== null &&
      input.medicationRefs.some(
        (ref) =>
          ref.masterVersionId === response.masterVersion?.masterVersionId,
      )
    ) {
      medicationVersionId = response.masterVersion.masterVersionId;
      const wanted = new Set(
        input.medicationRefs
          .filter(
            (ref) =>
              ref.masterVersionId ===
              response.masterVersion?.masterVersionId,
          )
          .map((ref) => ref.medicationItemId),
      );
      for (const item of response.items) {
        if (wanted.has(item.medicationItemId)) {
          medications.set(
            item.medicationItemId,
            `${item.localCode} ${item.name}`,
          );
        }
      }
    }
  }
  if (input.usageItemIds.length > 0) {
    const response = await searchMasterUsages(
      { asOf: input.asOf, q: "" },
      fetchImpl,
      signal,
    );
    const wanted = new Set(input.usageItemIds);
    for (const item of response.items) {
      if (wanted.has(item.usageItemId)) {
        usages.set(item.usageItemId, `${item.localCode} ${item.text}`);
      }
    }
  }
  return { medications, medicationVersionId, usages };
}
