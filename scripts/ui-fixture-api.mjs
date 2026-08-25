import { createServer } from "node:http";

const HOST = "127.0.0.1";
const PORT = Number.parseInt(process.env.UI_FIXTURE_API_PORT ?? "3001", 10);
const ALLOWED_ORIGIN =
  process.env.UI_FIXTURE_WEB_ORIGIN ?? "http://127.0.0.1:3000";

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
let fixtureClock = 0;

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

function prescriptionDraftReceptionId(pathname) {
  const prefix = "/prescription-drafts/by-reception/";
  return pathname.startsWith(prefix)
    ? decodeURIComponent(pathname.slice(prefix.length))
    : null;
}

function matchingReception(receptionId, patientId, businessDate) {
  return receptionEntries(businessDate).find(
    (entry) =>
      entry.receptionId === receptionId &&
      entry.patient.patientId === patientId,
  );
}

function draftKey(receptionId, patientId, businessDate) {
  return `${receptionId}:${patientId}:${businessDate}`;
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let raw = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 64_000) {
        reject(new Error("fixture request too large"));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function nextFixtureInstant() {
  fixtureClock += 1;
  return `2026-08-25T00:00:${String(fixtureClock).padStart(2, "0")}.000Z`;
}

async function handleRequest(request, response) {
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

  const receptionId = prescriptionDraftReceptionId(url.pathname);
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
    const draft = prescriptionDrafts.get(
      draftKey(receptionId, patientId, businessDate),
    );
    if (draft === undefined) {
      sendJson(request, response, 404, {
        statusCode: 404,
        error: "Not Found",
        message: "Prescription draft context not found",
      });
      return;
    }
    sendJson(request, response, 200, draft);
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
    if (
      typeof patientId !== "string" ||
      typeof businessDate !== "string" ||
      !Number.isInteger(expectedVersion) ||
      typeof body?.draft !== "object" ||
      body.draft === null ||
      matchingReception(receptionId, patientId, businessDate) === undefined
    ) {
      sendJson(request, response, 404, {
        statusCode: 404,
        error: "Not Found",
        message: "Prescription draft context not found",
      });
      return;
    }

    const key = draftKey(receptionId, patientId, businessDate);
    const existing = prescriptionDrafts.get(key);
    const currentVersion = existing?.version ?? 0;
    if (expectedVersion !== currentVersion) {
      sendJson(request, response, 409, {
        statusCode: 409,
        error: "Conflict",
        message: "Prescription draft version conflict",
      });
      return;
    }

    const now = nextFixtureInstant();
    const saved = {
      prescriptionId:
        existing?.prescriptionId ?? `prescription-${receptionId}`,
      receptionId,
      patientId,
      businessDate,
      version: currentVersion + 1,
      lifecycleStatus: "SERVER_SAVED",
      draft: body.draft,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      createdBy: existing?.createdBy ?? "actor-e2e",
      updatedBy: "actor-e2e",
      saveDisposition: existing === undefined ? "created" : "updated",
    };
    prescriptionDrafts.set(key, saved);
    sendJson(request, response, existing === undefined ? 201 : 200, saved);
    return;
  }

  sendJson(request, response, 404, {
    errorCode: "UI-FIXTURE-404",
    message: "Fixture route not found",
  });
}

const server = createServer((request, response) => {
  void handleRequest(request, response).catch(() => {
    if (!response.headersSent) {
      sendJson(request, response, 500, {
        statusCode: 500,
        error: "Internal Server Error",
        message: "Fixture request failed",
      });
    } else {
      response.destroy();
    }
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
