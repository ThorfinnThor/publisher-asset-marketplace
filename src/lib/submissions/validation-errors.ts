import type { SubmissionValidationFailure } from "./validate";

const messages: Record<string, string> = {
  invalid_payload: "Submission data is invalid.",
  unknown_field: "This field is not accepted.",
  url_required: "Enter a public HTTPS URL.",
  url_too_long: "The URL is too long.",
  url_contains_whitespace: "The URL cannot contain spaces.",
  invalid_url: "Enter a valid public HTTPS URL.",
  scheme_not_https: "Use an HTTPS URL.",
  credentials_not_allowed: "URLs containing credentials are not allowed.",
  host_required: "The URL needs a public host name.",
  port_not_allowed: "Custom URL ports are not allowed.",
  host_not_public: "Private and internal URLs are not allowed.",
  preview_required: "Add a preview image.",
  invalid_asset_type: "Choose a supported asset type.",
  text_required: "This field is required.",
  text_too_short: "This text is too short.",
  text_too_long: "This text is too long.",
  control_character: "This field contains unsupported characters.",
  raw_html_not_allowed: "Raw HTML is not allowed.",
  invalid_opportunity_topic: "Choose a valid opportunity topic.",
  boolean_required: "Choose yes or no for this declaration.",
  sandbox_compatibility_required:
    "Run the embed test and confirm that the asset works in the marketplace sandbox.",
  source_identity_confirmation_required: "Confirm that the source identity is accurate.",
  attribution_confirmation_required:
    "Confirm that the attribution URL and terms apply to this asset.",
  preview_display_authorization_required:
    "Authorize the marketplace to display this preview image.",
  authorization_required: "Confirm that you are authorized to submit this asset.",
  commercial_marketplace_acknowledgement_required:
    "Acknowledge that Cite Supply is a commercially operated marketplace.",
  creator_terms_acceptance_required: "Read and accept the current Creator Terms.",
};

export function submissionValidationErrorBody(failure: SubmissionValidationFailure): {
  error: string;
  code: string;
  field_errors?: Record<string, string>;
} {
  const message = messages[failure.code] ?? "Please correct the highlighted submission fields.";
  return {
    error: message,
    code: failure.code,
    ...(failure.field ? { field_errors: { [failure.field]: message } } : {}),
  };
}
