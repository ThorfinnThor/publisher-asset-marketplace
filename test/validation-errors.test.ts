import { describe, expect, it } from "vitest";

import { submissionValidationErrorBody } from "../src/lib/submissions/validation-errors";

describe("submission validation error responses", () => {
  it("preserves the invalid field and a specific HTTPS message", () => {
    expect(
      submissionValidationErrorBody({
        ok: false,
        code: "scheme_not_https",
        field: "canonical_url",
      }),
    ).toEqual({
      error: "Use an HTTPS URL.",
      code: "scheme_not_https",
      field_errors: { canonical_url: "Use an HTTPS URL." },
    });
  });

  it("preserves declaration field identity", () => {
    expect(
      submissionValidationErrorBody({
        ok: false,
        code: "authorization_required",
        field: "authorized_to_submit",
      }),
    ).toMatchObject({
      field_errors: {
        authorized_to_submit: "Confirm that you are authorized to submit this asset.",
      },
    });
  });
});
