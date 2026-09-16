# F2 “Build this” workflow

> Updated 2026-09-16: the manual-review references below are historical. Completed submissions now
> follow [Autonomous creator publishing](autonomous-publishing.md).

Status: implemented and deployed  
Model allocation: LUNA implementation

Public opportunity cards now link to `/submit?topic=...`. The submit page normalizes the topic with
the existing demand-query privacy rules, shows a visible demand-topic notice, pre-fills the title
and description as editable suggestions, and persists the normalized topic on the pending
submission.

The topic is metadata, not a ranking override or an authorization claim. It remains visible in the
submission record, and published assets retain it in their metadata. F2 does not generate an AI
widget and does not bypass the autonomous publication gates, rights evidence or creator
attestation.
