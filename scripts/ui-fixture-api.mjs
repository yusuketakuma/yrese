import { createHash } from "node:crypto";
import { createServer } from "node:http";

const HOST = "127.0.0.1";
const PORT = Number.parseInt(process.env.UI_FIXTURE_API_PORT ?? "3001", 10);
const ALLOWED_ORIGIN =
  process.env.UI_FIXTURE_WEB_ORIGIN ?? "http://127.0.0.1:3000";
const MAX_JSON_BODY_BYTES = 128 * 1024;

const patients = [
  {
    patientId: "patient-e2e-001",
    name: "テスト患者 一",
    kana: "テストカンジャ イチ",
    birthDate: "1950-01-02",
    sex: "female",
    patientNumber: "T-0001",
    eligibilityStatus: "VERIFIED",
    eligibilityCheckedAt: "2026-08-25T00:00:00.000Z",
  },
  {
    patientId: "patient-e2e-002",
    name: "テスト患者 二",
    kana: "テストカンジャ ニ",
    birthDate: "1960-02-03",
    sex: "male",
    patientNumber: "T-0002",
    eligibilityStatus: "VERIFIED",
    eligibilityCheckedAt: "2026-08-25T00:00:00.000Z",
  },
];

const prescriptionDrafts = new Map();

/**
 * UI 経由で登録された受付(冪等キー → entry)。
 * fixture サーバープロセス内だけで有効な揮発状態であり、合成値のみを保持する。
 * 種受付と同じく、登録分はどの業務日のキューにも出現させる — 日跨ぎ境界で
 * 登録時刻の JST 業務日と表示中の日付がずれても browser check が決定的に
 * PASS するための fixture 簡略化である(本物の日付帰属は API 層で検証済み)。
 */
const createdReceptionsByKey = new Map();
let createdReceptionSequence = 100;

function receptionEntries(date) {
  const seeds = [
    {
      receptionId: "reception-e2e-001",
      patient: patients[0],
      acceptedAt: `${date}T00:15:00.000Z`,
      receptionStatus: "WAITING",
      prescriptionIntakeType: "paper",
    },
    {
      receptionId: "reception-e2e-002",
      patient: patients[1],
      acceptedAt: `${date}T00:30:00.000Z`,
      receptionStatus: "IN_PROGRESS",
      prescriptionIntakeType: "paper",
    },
  ];
  return [...seeds, ...createdReceptionsByKey.values()];
}

// 運用集計フィクスチャ(合成値のみ)。件数・時刻・enum・スキーマ版数だけを返し、
// 患者識別子・氏名・カナ・生年月日・処方内容は一切含めない。
const RECEPTION_STATUS_ORDER = [
  "WAITING",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
];
const ELIGIBILITY_STATUS_ORDER = [
  "VERIFIED",
  "PENDING_REVERIFY",
  "LOCAL_ONLY_UNVERIFIED",
  "NOT_CHECKED",
];

function currentOutboxSummary() {
  const pendingCount = 2 + createdReceptionsByKey.size;
  return {
    pendingCount,
    deliveredCount: 1,
    oldestPendingCreatedAt: "2026-08-25T00:15:00.000Z",
    byEventType: [
      {
        eventType: "reception.created",
        pendingCount,
        deliveredCount: 1,
      },
    ],
    legacyOrphanCount: 0,
  };
}

const migrationState = {
  available: true,
  result: "up_to_date",
  appliedCount: 23,
  availableCount: 23,
  pendingVersions: [],
  latestAppliedVersion: "000023",
  latestAppliedName: "prescription_draft_copied_from",
};

function countByStatus(entries, pick, order) {
  return order.map((status) => ({
    status,
    count: entries.filter((entry) => pick(entry) === status).length,
  }));
}

function receptionSummary(date) {
  const entries = receptionEntries(date);
  return {
    date,
    totalCount: entries.length,
    byReceptionStatus: countByStatus(
      entries,
      (entry) => entry.receptionStatus,
      RECEPTION_STATUS_ORDER,
    ),
    byEligibilityStatus: countByStatus(
      entries,
      (entry) => entry.patient.eligibilityStatus,
      ELIGIBILITY_STATUS_ORDER,
    ),
  };
}

function corsHeaders(request) {
  return {
    "access-control-allow-origin": ALLOWED_ORIGIN,
    "access-control-allow-methods": "GET, POST, PUT, OPTIONS",
    "access-control-allow-headers":
      request.headers["access-control-request-headers"] ?? "*",
    "access-control-max-age": "600",
    "cache-control": "no-store",
    vary: "Origin, Access-Control-Request-Headers",
  };
}

function sendJson(request, response, status, body) {
  response.writeHead(status, {
    ...corsHeaders(request),
    "content-type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(body));
}

async function readJsonBody(request) {
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.byteLength;
    if (total > MAX_JSON_BODY_BYTES) throw new Error("fixture body too large");
    chunks.push(buffer);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  return JSON.parse(text);
}

function prescriptionDraftPath(pathname) {
  const prefix = "/prescription-drafts/by-reception/";
  return pathname.startsWith(prefix)
    ? decodeURIComponent(pathname.slice(prefix.length))
    : null;
}

function prescriptionDraftKey(receptionId, patientId, businessDate) {
  return JSON.stringify([receptionId, patientId, businessDate]);
}

function matchingReception(receptionId, businessDate) {
  return receptionEntries(businessDate).find(
    (entry) => entry.receptionId === receptionId,
  );
}

function draftTimestamp(version) {
  return new Date(Date.UTC(2026, 7, 25, 1, 0, version)).toISOString();
}

function makeDraftResponse({
  receptionId,
  patientId,
  businessDate,
  version,
  draft,
  createdAt,
  lifecycle,
}) {
  return {
    // businessDate を含め、同一 reception の日付違い draft で ID が
    // 衝突しないようにする。
    prescriptionId: `prescription-${receptionId}-${businessDate}`,
    receptionId,
    patientId,
    businessDate,
    version,
    draft,
    createdAt,
    updatedAt: draftTimestamp(version),
    createdBy: "actor-e2e",
    updatedBy: "actor-e2e",
    status: lifecycle?.status ?? null,
    confirmedBy: lifecycle?.confirmedBy ?? null,
    confirmedAt: lifecycle?.confirmedAt ?? null,
    finalizedBy: lifecycle?.finalizedBy ?? null,
    finalizedAt: lifecycle?.finalizedAt ?? null,
    prescriptionVersion: lifecycle?.prescriptionVersion ?? null,
    copiedFrom: null,
  };
}

function findDraftByPrescriptionId(prescriptionId) {
  for (const record of prescriptionDrafts.values()) {
    if (record.prescriptionId === prescriptionId) return record;
  }
  return null;
}

// 実装の guard は薬剤 item のみを数える(未解決用法は制度上許容、
// countUnresolvedPrescriptionItems と同じ基準)。
function fixtureDraftHasUnresolvedItems(draft) {
  for (const group of draft?.rpGroups ?? []) {
    for (const item of group?.items ?? []) {
      if (item?.medication?.kind === "unresolved") return true;
    }
  }
  return false;
}

function fixtureMetadataComplete(draft) {
  const source = draft?.sourceMetadata;
  return (
    draft?.prescriptionType !== undefined &&
    draft?.prescriptionType !== "UNSPECIFIED" &&
    typeof draft?.prescriptionDate === "string" &&
    Number.isInteger(draft?.defaultDays) &&
    source !== null &&
    typeof source === "object" &&
    typeof source?.medicalInstitution?.name === "string" &&
    typeof source?.prescriberName === "string" &&
    typeof source?.issueDate === "string" &&
    typeof source?.validUntil === "string"
  );
}

// lifecycle endpoint のエラー応答は errorResponseSchema({errorCode, message})
// 形状。locked PUT の framework 形状(code)とは別系統。
function lifecycleConflict(request, response, errorCode, message) {
  sendJson(request, response, 409, { errorCode, message });
}

function fixtureContentHash(draft) {
  return createHash("sha256").update(JSON.stringify(draft)).digest("hex");
}

// POST /prescriptions/{id}/{confirm,finalize} の 200 応答は
// prescriptionLifecycleViewSchema 形状(draft response ではない)。
function fixtureLifecycleView(record) {
  return {
    prescriptionId: record.prescriptionId,
    receptionId: record.receptionId,
    patientId: record.patientId,
    prescriptionType: record.draft?.prescriptionType ?? "UNSPECIFIED",
    status: record.status,
    draftVersion: record.version,
    prescriptionVersion: record.prescriptionVersion,
    contentHash: fixtureContentHash(record.draft),
    confirmedBy: record.confirmedBy,
    confirmedAt: record.confirmedAt,
    finalizedBy: record.finalizedBy,
    finalizedAt: record.finalizedAt,
  };
}

const LIFECYCLE_KEY_PATTERN = /^[A-Za-z0-9_-]{16,128}$/u;

const server = createServer(async (request, response) => {
  const method = request.method ?? "GET";
  const url = new URL(
    request.url ?? "/",
    `http://${request.headers.host ?? `${HOST}:${PORT}`}`,
  );

  if (method === "OPTIONS") {
    response.writeHead(204, corsHeaders(request));
    response.end();
    return;
  }

  if (method === "GET" && url.pathname === "/health") {
    sendJson(request, response, 200, {
      status: "ok",
      service: "api",
      version: "0.0.1",
      timestamp: "2026-08-25T00:00:00.000Z",
    });
    return;
  }

  if (method === "GET" && url.pathname === "/whoami") {
    sendJson(request, response, 200, {
      tenantId: "tenant-e2e",
      pharmacyId: "pharmacy-e2e",
      actorId: "actor-e2e",
      scopes: [
        "tenant:read",
        "tenant:admin",
        "user:admin",
        "patient:read",
        "reception:read",
        "prescription:read",
        "prescription:write",
        "sync:read",
      ],
    });
    return;
  }

  if (method === "GET" && url.pathname === "/patients/search") {
    const query = (url.searchParams.get("q") ?? "").normalize("NFKC").trim();
    const normalized = query.toLowerCase();
    const results =
      normalized.length === 0
        ? []
        : patients.filter((patient) =>
            [
              patient.name,
              patient.kana,
              patient.patientNumber,
              patient.patientId,
            ]
              .join(" ")
              .normalize("NFKC")
              .toLowerCase()
              .includes(normalized),
          );
    sendJson(request, response, 200, { results });
    return;
  }

  if (method === "GET" && url.pathname.startsWith("/patients/")) {
    const patientId = decodeURIComponent(url.pathname.slice("/patients/".length));
    const patient = patients.find((candidate) => candidate.patientId === patientId);
    if (patient === undefined) {
      sendJson(request, response, 404, {
        errorCode: "PAT-0002",
        message: "Patient not found",
      });
      return;
    }
    sendJson(request, response, 200, patient);
    return;
  }

  if (method === "GET" && url.pathname === "/reception/queue") {
    const date = url.searchParams.get("date");
    if (date === null) {
      sendJson(request, response, 400, {
        errorCode: "RCV-0001",
        message: "date is required",
      });
      return;
    }
    sendJson(request, response, 200, {
      date,
      entries: receptionEntries(date),
    });
    return;
  }

  if (method === "GET" && url.pathname === "/operations/outbox-summary") {
    sendJson(request, response, 200, currentOutboxSummary());
    return;
  }

  // POST /reception: 実サーバーと同じ冪等契約。同一 idempotencyKey の再送は
  // 既存 entry を 200 で返し、別 patientId への key 再利用は 409。
  if (method === "POST" && url.pathname === "/reception") {
    let body;
    try {
      body = await readJsonBody(request);
    } catch {
      sendJson(request, response, 400, {
        errorCode: "RCV-0001",
        message: "Invalid reception request",
      });
      return;
    }
    const patientId = body?.patientId;
    const idempotencyKey = body?.idempotencyKey;
    if (
      typeof patientId !== "string" ||
      typeof idempotencyKey !== "string" ||
      idempotencyKey.trim().length === 0
    ) {
      sendJson(request, response, 400, {
        errorCode: "RCV-0001",
        message: "Invalid reception request",
      });
      return;
    }
    const patient = patients.find(
      (candidate) => candidate.patientId === patientId,
    );
    if (patient === undefined) {
      sendJson(request, response, 404, {
        errorCode: "RCV-0002",
        message: "Patient not found for reception",
      });
      return;
    }
    const existing = createdReceptionsByKey.get(idempotencyKey);
    if (existing !== undefined) {
      if (existing.patient.patientId !== patientId) {
        sendJson(request, response, 409, {
          errorCode: "RCV-0003",
          message: "Reception idempotency conflict",
        });
        return;
      }
      sendJson(request, response, 200, existing);
      return;
    }
    createdReceptionSequence += 1;
    const entry = {
      receptionId: `reception-e2e-${createdReceptionSequence}`,
      patient,
      acceptedAt: new Date().toISOString(),
      receptionStatus: "WAITING",
      prescriptionIntakeType: "paper",
    };
    createdReceptionsByKey.set(idempotencyKey, entry);
    sendJson(request, response, 201, entry);
    return;
  }

  if (method === "GET" && url.pathname === "/operations/reception-summary") {
    const date = url.searchParams.get("date");
    if (date === null || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      sendJson(request, response, 400, {
        errorCode: "RCV-0001",
        message: "Invalid reception request",
      });
      return;
    }
    sendJson(request, response, 200, receptionSummary(date));
    return;
  }

  if (method === "GET" && url.pathname === "/operations/migration-state") {
    sendJson(request, response, 200, migrationState);
    return;
  }

  const lifecycleMatch = /^\/prescriptions\/([^/]+)\/(confirm|finalize)$/u.exec(
    url.pathname,
  );
  if (lifecycleMatch !== null && method === "POST") {
    const [, prescriptionId, action] = lifecycleMatch;
    const idempotencyKey = request.headers["idempotency-key"];
    if (
      typeof idempotencyKey !== "string" ||
      !LIFECYCLE_KEY_PATTERN.test(idempotencyKey)
    ) {
      sendJson(request, response, 400, {
        errorCode: "RX-0005",
        message: "Invalid prescription lifecycle request",
      });
      return;
    }
    const record = findDraftByPrescriptionId(prescriptionId);
    if (record === null) {
      sendJson(request, response, 404, {
        errorCode: "RX-0006",
        message: "Prescription not found",
      });
      return;
    }
    if (action === "confirm") {
      if (record.status === "PHARMACIST_CONFIRMED") {
        if (record.confirmIdempotencyKey === idempotencyKey) {
          sendJson(request, response, 200, fixtureLifecycleView(record));
          return;
        }
        lifecycleConflict(
          request,
          response,
          "RX-0002",
          "Prescription lifecycle transition is not allowed",
        );
        return;
      }
      if (record.status !== null) {
        lifecycleConflict(
          request,
          response,
          "RX-0002",
          "Prescription lifecycle transition is not allowed",
        );
        return;
      }
      const reception = matchingReception(
        record.receptionId,
        record.businessDate,
      );
      if (reception?.receptionStatus !== "IN_PROGRESS") {
        lifecycleConflict(
          request,
          response,
          "RX-0004",
          "Reception is not IN_PROGRESS for pharmacist confirmation",
        );
        return;
      }
      if (fixtureDraftHasUnresolvedItems(record.draft)) {
        lifecycleConflict(
          request,
          response,
          "RX-0001",
          "Prescription contains unresolved medication items",
        );
        return;
      }
      if (!fixtureMetadataComplete(record.draft)) {
        lifecycleConflict(
          request,
          response,
          "RX-0003",
          "Prescription source metadata is incomplete",
        );
        return;
      }
      record.status = "PHARMACIST_CONFIRMED";
      record.confirmedBy = "actor-e2e";
      record.confirmedAt = draftTimestamp(record.version + 90);
      record.confirmIdempotencyKey = idempotencyKey;
      sendJson(request, response, 200, fixtureLifecycleView(record));
      return;
    }
    if (record.status === "PRESCRIPTION_FINALIZED") {
      if (record.finalizeIdempotencyKey === idempotencyKey) {
        sendJson(request, response, 200, fixtureLifecycleView(record));
        return;
      }
      lifecycleConflict(
        request,
        response,
        "RX-0002",
        "Prescription lifecycle transition is not allowed",
      );
      return;
    }
    if (record.status !== "PHARMACIST_CONFIRMED") {
      lifecycleConflict(
        request,
        response,
        "RX-0002",
        "Prescription lifecycle transition is not allowed",
      );
      return;
    }
    // finalize 時点でも確定対象を再検証する(実装との parity)。
    if (fixtureDraftHasUnresolvedItems(record.draft)) {
      lifecycleConflict(
        request,
        response,
        "RX-0001",
        "Prescription contains unresolved medication items",
      );
      return;
    }
    if (!fixtureMetadataComplete(record.draft)) {
      lifecycleConflict(
        request,
        response,
        "RX-0003",
        "Prescription source metadata is incomplete",
      );
      return;
    }
    record.status = "PRESCRIPTION_FINALIZED";
    record.finalizedBy = "actor-e2e";
    record.finalizedAt = draftTimestamp(record.version + 95);
    record.prescriptionVersion = 1;
    record.finalizeIdempotencyKey = idempotencyKey;
    sendJson(request, response, 200, fixtureLifecycleView(record));
    return;
  }

  const receptionId = prescriptionDraftPath(url.pathname);
  if (receptionId !== null && method === "GET") {
    const businessDate = url.searchParams.get("date");
    if (
      businessDate === null ||
      url.searchParams.size !== 1
    ) {
      sendJson(request, response, 400, {
        statusCode: 400,
        error: "Bad Request",
        message: "Invalid prescription draft request",
      });
      return;
    }
    const reception = matchingReception(receptionId, businessDate);
    if (reception === undefined) {
      sendJson(request, response, 404, {
        statusCode: 404,
        error: "Not Found",
        message: "Prescription draft context not found",
      });
      return;
    }
    const patientId = reception.patient.patientId;
    const record = prescriptionDrafts.get(
      prescriptionDraftKey(receptionId, patientId, businessDate),
    );
    if (record === undefined) {
      response.writeHead(204, corsHeaders(request));
      response.end();
      return;
    }
    // 内部保持の冪等 key は wire 応答に含めない(実 API も公開しない)。
    const {
      confirmIdempotencyKey: _confirmKey,
      finalizeIdempotencyKey: _finalizeKey,
      ...publicRecord
    } = record;
    sendJson(request, response, 200, publicRecord);
    return;
  }

  if (receptionId !== null && method === "PUT") {
    let body;
    try {
      body = await readJsonBody(request);
    } catch {
      sendJson(request, response, 400, {
        statusCode: 400,
        error: "Bad Request",
        message: "Invalid prescription draft request",
      });
      return;
    }
    const patientId = body?.patientId;
    const businessDate = body?.businessDate;
    const expectedVersion = body?.expectedVersion;
    const draft = body?.draft;
    if (
      typeof patientId !== "string" ||
      typeof businessDate !== "string" ||
      !Number.isInteger(expectedVersion) ||
      draft === null ||
      typeof draft !== "object"
    ) {
      sendJson(request, response, 400, {
        statusCode: 400,
        error: "Bad Request",
        message: "Invalid prescription draft request",
      });
      return;
    }
    const reception = matchingReception(receptionId, businessDate);
    if (
      reception === undefined ||
      reception.patient.patientId !== patientId
    ) {
      sendJson(request, response, 404, {
        statusCode: 404,
        error: "Not Found",
        message: "Prescription draft context not found",
      });
      return;
    }
    const ifMatch = request.headers["if-match"];
    if (
      (expectedVersion === 0 && ifMatch !== undefined) ||
      (expectedVersion > 0 && ifMatch !== `"${expectedVersion}"`)
    ) {
      sendJson(request, response, 400, {
        statusCode: 400,
        error: "Bad Request",
        message: "Invalid prescription draft request",
      });
      return;
    }

    const key = prescriptionDraftKey(receptionId, patientId, businessDate);
    const existing = prescriptionDrafts.get(key);
    const content = JSON.stringify(draft);
    if (existing === undefined) {
      if (expectedVersion !== 0) {
        sendJson(request, response, 409, {
          statusCode: 409,
          error: "Conflict",
          message: "Prescription draft version conflict",
        });
        return;
      }
      const createdAt = draftTimestamp(1);
      const saved = makeDraftResponse({
        receptionId,
        patientId,
        businessDate,
        version: 1,
        draft,
        createdAt,
      });
      prescriptionDrafts.set(key, saved);
      sendJson(request, response, 201, {
        ...saved,
        saveDisposition: "created",
      });
      return;
    }

    if (existing.status !== null) {
      sendJson(request, response, 409, {
        statusCode: 409,
        error: "Conflict",
        code: "RX-0002",
        message: "Prescription draft is confirmed or finalized",
      });
      return;
    }
    const existingContent = JSON.stringify(existing.draft);
    if (expectedVersion !== existing.version) {
      sendJson(request, response, 409, {
        statusCode: 409,
        error: "Conflict",
        message: "Prescription draft version conflict",
      });
      return;
    }
    if (content === existingContent) {
      sendJson(request, response, 200, {
        ...existing,
        saveDisposition: "unchanged",
      });
      return;
    }

    const saved = makeDraftResponse({
      receptionId,
      patientId,
      businessDate,
      version: existing.version + 1,
      draft,
      createdAt: existing.createdAt,
    });
    prescriptionDrafts.set(key, saved);
    sendJson(request, response, 200, {
      ...saved,
      saveDisposition: "updated",
    });
    return;
  }

  sendJson(request, response, 404, {
    errorCode: "UI-FIXTURE-404",
    message: "Fixture route not found",
  });
});

function shutdown(signal) {
  server.close((error) => {
    if (error !== undefined) {
      console.error(`fixture API shutdown failed after ${signal}`);
      process.exitCode = 1;
    }
  });
}

server.listen(PORT, HOST, () => {
  console.log(`fixture API listening on http://${HOST}:${PORT}`);
});

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
