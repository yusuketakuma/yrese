import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PatientCreateResponse } from "@yrese/contracts";

import {
  createPatient,
  PatientRegistrationForm,
} from "./patient-registration";

(globalThis as { React?: typeof React }).React = React;

const createdResponse: PatientCreateResponse = {
  patient: {
    patientId: "patient-new-001",
    name: "登録 患者",
    kana: "トウロクカンジャ",
    birthDate: "1980-04-01",
    sex: "female",
    patientNumber: "P-000001",
    eligibilityStatus: "NOT_CHECKED",
    version: 1,
  },
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createPatient transport (SCR-002-C)", () => {
  it("posts the payload with Idempotency-Key and dev tenant write+read scopes", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const fetchMock = vi.fn(async () => jsonResponse(201, createdResponse));
    const result = await createPatient(
      {
        name: "登録 患者",
        kana: "トウロクカンジャ",
        birthDate: "1980-04-01",
        sex: "female",
      },
      "Abcd1234_abcd1234",
      fetchMock,
    );
    expect(result).toEqual(createdResponse);
    const [, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit & { headers: Record<string, string> },
    ];
    expect(init.method).toBe("POST");
    expect(init.headers["idempotency-key"]).toBe("Abcd1234_abcd1234");
    expect(init.headers["x-dev-scopes"]).toBe("patient:write,patient:read");
    expect(JSON.parse(String(init.body))).toEqual({
      name: "登録 患者",
      kana: "トウロクカンジャ",
      birthDate: "1980-04-01",
      sex: "female",
    });
  });

  it("accepts a 200 idempotent replay as success", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const fetchMock = vi.fn(async () => jsonResponse(200, createdResponse));
    const result = await createPatient(
      {
        name: "登録 患者",
        kana: "トウロクカンジャ",
        birthDate: "1980-04-01",
        sex: "female",
      },
      "Abcd1234_abcd1234",
      fetchMock,
    );
    expect(result.patient.patientId).toBe("patient-new-001");
  });

  it("surfaces 409 PAT-0003 as a patient-number conflict notice", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const fetchMock = vi.fn(async () =>
      jsonResponse(409, { errorCode: "PAT-0003", message: "conflict" }),
    );
    await expect(
      createPatient(
        {
          name: "登録 患者",
          kana: "トウロクカンジャ",
          birthDate: "1980-04-01",
          sex: "female",
          patientNumber: "P-000001",
        },
        "Abcd1234_abcd1234",
        fetchMock,
      ),
    ).rejects.toMatchObject({
      notice: {
        message: "その患者番号は既に使用されています。",
        errorCode: "PAT-0003",
      },
    });
  });

  it("rejects a malformed success body at the contract boundary", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const fetchMock = vi.fn(async () =>
      jsonResponse(201, { patient: { patientId: "x" } }),
    );
    await expect(
      createPatient(
        {
          name: "登録 患者",
          kana: "トウロクカンジャ",
          birthDate: "1980-04-01",
          sex: "female",
        },
        "Abcd1234_abcd1234",
        fetchMock,
      ),
    ).rejects.toThrow();
  });

  it("does not echo unregistered error codes from failure bodies", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const fetchMock = vi.fn(async () =>
      jsonResponse(400, { errorCode: "PAT-0003", message: "wrong status" }),
    );
    await expect(
      createPatient(
        {
          name: "登録 患者",
          kana: "トウロクカンジャ",
          birthDate: "1980-04-01",
          sex: "female",
        },
        "Abcd1234_abcd1234",
        fetchMock,
      ),
    ).rejects.toMatchObject({
      notice: { message: "登録内容が不正です。" },
    });
  });
});

describe("PatientRegistrationForm rendering", () => {
  it("renders the registration fields and submit control", () => {
    const html = renderToStaticMarkup(
      <PatientRegistrationForm onRegistered={() => {}} />,
    );
    expect(html).toContain("新規患者登録");
    expect(html).toContain('id="patient-reg-name"');
    expect(html).toContain('id="patient-reg-kana"');
    expect(html).toContain('id="patient-reg-birthdate"');
    expect(html).toContain('id="patient-reg-sex"');
    expect(html).toContain('id="patient-reg-number"');
    expect(html).toContain("この患者を登録");
  });
});
