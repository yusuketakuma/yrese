import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FILE_UPLOAD_STATUSES, FileUploadStatusIndicator } from "./file-upload-status";

(globalThis as { React?: typeof React }).React = React;

describe("FileUploadStatusIndicator", () => {
  it("marks only COMPLETED as durable (完了前に保存済みと誤認させない)", () => {
    const completed = renderToStaticMarkup(
      <FileUploadStatusIndicator status="COMPLETED" fileName="scan.pdf" />,
    );
    const uploading = renderToStaticMarkup(<FileUploadStatusIndicator status="UPLOADING" />);
    expect(completed).toContain('data-durable="true"');
    expect(completed).toContain("完了(保存済み)");
    expect(uploading).toContain('data-durable="false"');
    expect(uploading).toContain("アップロード中");
  });

  it("uses alert role for rejection and retryable error", () => {
    const rejected = renderToStaticMarkup(
      <FileUploadStatusIndicator status="REJECTED" message="形式が不正です" />,
    );
    const retry = renderToStaticMarkup(<FileUploadStatusIndicator status="RETRYABLE_ERROR" />);
    expect(rejected).toContain('role="alert"');
    expect(rejected).toContain("拒否(受付不可)");
    expect(rejected).toContain("形式が不正です");
    expect(retry).toContain("失敗(再試行可)");
  });

  it("labels every status with a non-empty visible label", () => {
    for (const status of FILE_UPLOAD_STATUSES) {
      const html = renderToStaticMarkup(<FileUploadStatusIndicator status={status} />);
      expect(html).toContain(`data-upload-status="${status}"`);
    }
  });
});
