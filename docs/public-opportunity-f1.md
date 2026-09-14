# F1 public creator opportunity surface

Status: implemented and deployed  
Model allocation: LUNA implementation

`/opportunities` is the public supply-side surface for the marketplace flywheel. It is backed by
the latest complete 28-day `opportunity_scores` snapshot, and it only selects rows that have passed
the deterministic scoring minimum and have low safe/embeddable supply.

## Public contract

- The page shows the normalized public query plus demand and supply buckets.
- Exact search totals, session totals, opportunity scores and inventory counts stay internal.
- Only `status = 'scored'` rows with at least five searches, no more than two safe assets and no
  more than one embeddable asset are eligible.
- Public copy says the signal represents discovery opportunity. It does not promise traffic,
  publication, citations, embeds, referral exposure or backlinks.
- If no completed score snapshot is available, the page shows a safe empty state rather than
  inventing opportunities.

The existing `/submit` flow is linked as the next action. Topic-prefilled submission drafts are
reserved for F2.
