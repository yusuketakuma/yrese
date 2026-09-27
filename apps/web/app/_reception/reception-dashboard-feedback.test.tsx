import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

(globalThis as { React?: typeof React }).React = React;

import type {
  PatientSearchResult,
  ReceptionQueueEntry,
  ReceptionQueueResponse,
} from "@yrese/contracts";

import {
  ReceptionDashboard,
  ReceptionError,
  ReceptionRegistrationForm,
  ReceptionQueueTable,
  ReceptionQueueView,
  createReception,
  createReceptionDashboardLifecycle,
  createReceptionQueueRunner,
  createReceptionIdempotencyKeyStore,
  createReceptionQueueTargetTracker,
  createReceptionRegistrationRunner,
  fetchReceptionQueue,
  formatAcceptedTime,
  isSettledReceptionCreateFailure,
  parseDateParam,
  RECEPTION_STATUS_LABELS,
  receptionDashboardDisplayButtonLabel,
  receptionQueueMetrics,
  ReceptionQueueMetricsView,
  registrationPatientChangeNotice,
  subscribeReceptionQueueRefreshOnVisible,
  submitReceptionRegistration,
  type QueueState,
  todayAsIsoDate,
} from './reception-dashboard';
import ReceptionPage from '../page';

import {
  unverifiedEligibility,
  patient,
  entry,
  queueResponse,
  jsonResponse,
  deferredValue,
  withNodeEnv,
} from './reception-dashboard-test-support';

describe('reception dashboard feedback and stale-state markers', () => {
  it("cleans ownership and rejects after a synchronous loading emit failure", async () => {
    const emitFailure = new Error("synthetic emit failure");
    const fetcher = vi.fn().mockResolvedValue(queueResponse("2026-07-10"));
    let failEmit = true;
    let state: QueueState = { kind: "loading" };
    const run = createReceptionQueueRunner(fetcher, (update) => {
      if (failEmit) {
        failEmit = false;
        throw emitFailure;
      }
      state = update(state);
    });

    await expect(run("2026-07-10")).rejects.toBe(emitFailure);
    await run("2026-07-10");

    expect(fetcher).toHaveBeenCalledOnce();
    expect(state.kind).toBe("loaded");
  });

  it("handles a synchronous fetch throw, cleans ownership, and admits retry", async () => {
    const fetcher = vi
      .fn<() => Promise<ReceptionQueueResponse>>()
      .mockImplementationOnce(() => {
        throw new Error("synthetic synchronous fetch failure");
      })
      .mockResolvedValueOnce(queueResponse("2026-07-10"));
    const states: QueueState[] = [{ kind: "loading" }];
    const run = createReceptionQueueRunner(fetcher, (update) => {
      states.push(update(states[states.length - 1]!));
    });

    await run("2026-07-10");
    expect(states.at(-1)?.kind).toBe("error");
    await run("2026-07-10");

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(states.at(-1)?.kind).toBe("loaded");
  });
  it("shows the last-updated time so a stale queue is not read as current (S-02)", () => {
    const html = renderToStaticMarkup(
      <ReceptionQueueView
        state={{
          kind: "loaded",
          response: queueResponse("2026-07-10", [entry({ receptionId: "rc-1" })]),
          loadedAt: "05:15",
          refreshState: { kind: "idle" },
        }}
      />,
    );
    expect(html).toContain("最終取得: 05:15");
  });

  it("omits last-updated when the loaded state has no timestamp", () => {
    const html = renderToStaticMarkup(
      <ReceptionQueueView
        state={{
          kind: "loaded",
          response: queueResponse("2026-07-10", [entry({ receptionId: "rc-1" })]),
          refreshState: { kind: "idle" },
        }}
      />,
    );
    expect(html).not.toContain("最終取得:");
  });

  it("marks the selected patient's row with a boolean marker and visible text, leaking no identifier (WP-5212-3)", () => {
    const html = renderToStaticMarkup(
      <ReceptionQueueTable
        entries={[
          entry({ receptionId: "rc-1", patient: patient({ patientId: "p1", patientNumber: "T-0001" }) }),
          entry({ receptionId: "rc-2", patient: patient({ patientId: "p2", patientNumber: "T-0002" }) }),
        ]}
        selectedPatientId="p2"
      />,
    );

    expect(html).toContain("選択中");
    expect((html.match(/data-selected="true"/g) ?? []).length).toBe(1);
    expect(html).not.toContain("data-patient-id");
    expect(html).not.toContain("p2\"");
    expect(html).not.toContain(">p2<");
  });

  it("does not mark any row when no patient is selected (WP-5212-3)", () => {
    const html = renderToStaticMarkup(
      <ReceptionQueueTable entries={[entry({ receptionId: "rc-1" })]} />,
    );

    expect(html).not.toContain("選択中");
    expect(html).not.toContain("data-selected");
  });

  it("gives the queue table a visible title caption and drops the legacy reception-queue class (WP-5212-4)", () => {
    const html = renderToStaticMarkup(
      <ReceptionQueueTable
        entries={[entry({ receptionId: "rc-1" })]}
        businessDate="2026-08-27"
      />,
    );

    expect(html).toContain("<caption");
    expect(html).toContain("operator-table-caption");
    expect(html).toContain("2026-08-27");
    expect(html).not.toContain('class="reception-queue"');
    expect(html).toMatch(/<table class="operator-table/);
  });

  it("keeps the scroll-region label distinct from the table caption title (WP-5212-4)", () => {
    const html = renderToStaticMarkup(
      <ReceptionQueueTable
        entries={[entry({ receptionId: "rc-1" })]}
        businessDate="2026-08-27"
      />,
    );

    expect(html).toContain("受付キュー表。横方向にスクロールできます");
    expect(html).toContain("2026-08-27 の受付キュー");
  });
});
