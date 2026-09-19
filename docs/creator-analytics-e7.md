# E7 creator asset analytics

Status: implemented and deployed  
Model allocation: LUNA implementation

The creator dashboard now shows first-party publisher signals for every published asset owned by
the authenticated creator. The dashboard uses the current rolling UTC 28-day window, including
today, and never
accepts a creator id from the browser: the server derives it from the GitHub-backed session and
binds it to both D1 reads.

## Signals

| Dashboard label       | Event definition                                                  | Interpretation                                                                   |
| --------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Search impressions    | `asset_events.event_type = 'impression'` joined to a search event | The asset appeared in a tracked result set.                                      |
| Detail views          | `detail_view`                                                     | A publisher opened the public asset page.                                        |
| Embed copies (intent) | `embed_copy`                                                      | A publisher requested reviewed embed markup; this does not confirm publication.  |
| Embed loads (actual)  | Approved iframe requests aggregated in `embed_usage_daily`        | The reviewed embed delivery path was actually requested as an iframe.            |
| Publisher sites       | Distinct hashed referring origins in `embed_publisher_daily`      | Lower-bound count of sites loading the embed; suppressed referrers are excluded. |
| Citation copies       | `citation_copy`                                                   | A publisher requested the reviewed citation text.                                |
| Source clicks         | `source_click`                                                    | A publisher clicked the reviewed source/attribution URL; this is not a backlink. |

Top discovery queries are calculated from normalized search wording attached to impression events.
Sensitive queries rejected by the demand-query privacy rules (email addresses, credentials, phone
numbers and high-entropy identifiers) are not displayed. The UI renders normalized query text as
text, never as HTML.

## Isolation and failure behavior

- Asset rows require `creator_id = authenticated profile id` and `status = 'published'`.
- Query rows repeat the same creator and published-status boundary, so one creator cannot inspect
  another creator's assets by changing a URL or request parameter.
- Intent counts are read from the existing append-only event tables. Actual embed loads and
  publisher-site counts use compact daily aggregates populated by the Worker; raw high-volume
  requests are also written to Workers Analytics Engine for operational analysis.
- If D1 is unavailable, the dashboard keeps the profile and shows a temporary analytics notice.

The signals are directional product analytics. They are not a promise of traffic, citation,
embed publication, source credit or backlink acquisition.

Actual embed-load tracking started on 19 September 2026. Earlier loads cannot be reconstructed,
and newly recorded loads appear in the creator dashboard without waiting for the UTC day to close.
