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

function corsHeaders(request) {
  return {
    "access-control-allow-origin": ALLOWED_ORIGIN,
    "access-control-allow-methods": "GET, POST, OPTIONS",
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

const server = createServer((request, response) => {
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
      scopes: ["tenant:read", "tenant:admin", "user:admin"],
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
    sendJson(request, response, 200, { date, entries: [] });
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
