import { describe, expect, it } from "vitest";

import {
  insertUrlRescanJobSql,
  parseUrlScanResultMessage,
} from "../src/lib/submissions/url-scan-jobs";

describe("URL scan result messages", () => {
  const jobId = "123e4567-e89b-42d3-a456-426614174000";

  it("accepts a bounded running transition", () => {
    expect(
      parseUrlScanResultMessage({
        schema_version: 1,
        job_id: jobId,
        attempt: 1,
        status: "running",
      }),
    ).toEqual({ schema_version: 1, job_id: jobId, attempt: 1, status: "running" });
  });

  it("accepts only known failure codes", () => {
    expect(
      parseUrlScanResultMessage({
        schema_version: 1,
        job_id: jobId,
        attempt: 3,
        status: "failed",
        error_code: "navigation_timeout",
      }),
    ).not.toBeNull();
    expect(
      parseUrlScanResultMessage({
        schema_version: 1,
        job_id: jobId,
        attempt: 1,
        status: "failed",
        error_code: "publish_without_review",
      }),
    ).toBeNull();
  });

  it.each([
    { schema_version: 2, job_id: jobId, attempt: 1, status: "running" },
    { schema_version: 1, job_id: "not-a-uuid", attempt: 1, status: "running" },
    { schema_version: 1, job_id: jobId, attempt: 4, status: "running" },
    { schema_version: 1, job_id: jobId, attempt: 1, status: "converted" },
  ])("rejects malformed or unauthorized transitions", (message) => {
    expect(parseUrlScanResultMessage(message)).toBeNull();
  });

  it("only inserts a rescan after its owned needs-changes row was expired", () => {
    expect(insertUrlRescanJobSql).toContain("status = 'expired'");
    expect(insertUrlRescanJobSql).toContain("updated_at = ?");
    expect(insertUrlRescanJobSql.match(/\?/gu)).toHaveLength(16);
  });
});
