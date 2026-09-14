# D4 internal opportunity dashboard

The `/admin/demand` route now renders the internal demand dashboard specified in the implementation
plan. It is server-rendered, marked `noindex`, and reads only aggregate D2/D3 rows plus attributed
copy events.

## Views

- **Top searches:** current complete 28-day search volume.
- **Fastest-growing queries:** current volume versus the preceding complete 28-day window. A
  query with no previous volume is labelled `New`; this comparison is not part of the v1 score.
- **No-result queries:** at least five searches, ranked by no-result rate.
- **Low-supply / high-demand:** scored queries with no more than two safe and one embeddable
  matching assets.
- **Top copied assets:** embed and citation copies attributed to a search event.

The page intentionally does not expose raw search events, anonymous session identifiers, or
suppressed D1 query forms. Authentication and an admin access boundary remain a later marketplace
milestone; until then this route is an internal preview and is not linked from public navigation.
