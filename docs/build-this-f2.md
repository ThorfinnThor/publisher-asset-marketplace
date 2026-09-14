# F2 “Build this” workflow

Status: implemented and deployed  
Model allocation: LUNA implementation

Public opportunity cards now link to `/submit?topic=...`. The submit page normalizes the topic with
the existing demand-query privacy rules, shows a visible demand-topic notice, pre-fills the title
and description as editable suggestions, and persists the normalized topic on the pending
submission.

The topic is metadata, not a ranking override or an authorization claim. Moderators see it in the
review queue, and approved assets retain it in the published asset metadata. F2 does not generate
an AI widget and does not bypass manual review, rights evidence or creator attestation.
