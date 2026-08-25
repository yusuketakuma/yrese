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

function receptionEntries(date) {
  return [
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

function matchingReception(receptionId, patientId, businessDate) {
  return receptionEntries(businessDate).find(
    (entry) =>
      entry.receptionId === receptionId && entry.patient.patientId === patientId,
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
}) {
  return {
    prescriptionId: `prescription-${receptionId}`,
    receptionId,
    patientId,
    businessDate,
    version,
    lifecycleStatus: "SERVER_SAVED",
    draft,
    createdAt,
    updatedAt: draftTimestamp(version),
    createdBy: "actor-e2e",
    updatedBy: "actor-e2e",
  };
}

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
        errorCode: "PATIENT-0001",
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
        errorCode: "RECEPTION-0001",
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

  const receptionId = prescriptionDraftPath(url.pathname);
  if (receptionId !== null && method === "GET") {
    const patientId = url.searchParams.get("patientId");
    const businessDate = url.searchParams.get("date");
    if (
      patientId === null ||
      businessDate === null ||
      matchingReception(receptionId, patientId, businessDate) === undefined
    ) {
      sendJson(request, response, 404, {
        statusCode: 404,
        error: "Not Found",
        message: "Prescription draft context not found",
      });
      return;
    }
    const record = prescriptionDrafts.get(
      prescriptionDraftKey(receptionId, patientId, businessDate),
    );
    if (record === undefined) {
      sendJson(request, response, 404, {
        statusCode: 404,
        error: "Not Found",
        message: "Prescription draft context not found",
      });
      return;
    }
    sendJson(request, response, 200, record);
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
      typeof draft !== "object" ||
      matchingReception(receptionId, patientId, businessDate) === undefined
    ) {
      sendJson(request, response, 404, {
        statusCode: 404,
        error: "Not Found",
        message: "Prescription draft context not found",
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

    const existingContent = JSON.stringify(existing.draft);
    if (expectedVersion + 1 === existing.version && content === existingContent) {
      sendJson(request, response, 200, {
        ...existing,
        saveDisposition: "replayed",
      });
      return;
    }
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
