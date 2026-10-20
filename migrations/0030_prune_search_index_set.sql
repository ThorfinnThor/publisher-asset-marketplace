-- Google Search Console (20 Oct 2026) reports 459 of 516 sitemap URLs as
-- "Discovered - currently not indexed": the young domain is not given crawl
-- budget for ~500 templated asset pages. Shrink the indexable set to a small,
-- defensible core so crawl and quality signals concentrate on fewer pages.
-- Pruned pages stay public with noindex, follow and leave the sitemap.
CREATE TABLE keep_indexable_slugs (slug TEXT PRIMARY KEY);

-- Released editorial pilot cohort, plus every asset page Google has already
-- indexed or shown in search results (GSC export, 21 Sep - 18 Oct 2026).
INSERT OR IGNORE INTO keep_indexable_slugs (slug) VALUES
  ('eurostat-nrg_ind_ren'),
  ('solar-pv-prices'),
  ('years-of-fossil-fuel-reserves-left'),
  ('adequacy-of-social-safety-net-programs'),
  ('agriculture-value-added-per-worker-wdi'),
  ('covid-19-cumulative-confirmed-cases-vs-confirmed-deaths'),
  ('covid-19-testing-policy'),
  ('covid-booster-vaccinated-by-age'),
  ('cumulative-deaths-and-cases-covid-19'),
  ('daily-cases-covid-region'),
  ('daily-protein-supply-of-animal-origin-vs-plant-origin'),
  ('death-rate-from-suicides-ghe'),
  ('elec-fossil-nuclear-renewables'),
  ('equality-of-political-power-across-social-groups-score'),
  ('estimated-destroyable-area-by-nuclear-weapons-deliverable-in-first-strike'),
  ('eurostat-ei_bpm6fa_q'),
  ('eurostat-migr_asywitfina'),
  ('eurostat-tour_ce_oam'),
  ('eurostat-tour_ce_oar'),
  ('eurostat-une_rt_a'),
  ('excess-deaths-cumulative-economist-single-entity'),
  ('fossil-fuel-subsidies-per-capita'),
  ('homelessness-rate-point-in-time-count'),
  ('key-features-of-human-rights'),
  ('land-area-hectares'),
  ('macroplastics-in-ocean'),
  ('medium-high-level-implementation-of-sustainable-public-procurement'),
  ('number-nutritional-diet-unaffordable'),
  ('protein-efficiency-of-meat-and-dairy-production'),
  ('severe-food-insecurity-undernourishment'),
  ('share-cereals-industrial-uses'),
  ('share-enrolled-in-private-institutions-at-the-pre-primary-education-level'),
  ('share-of-students-achieving-minimum-proficiency-in-reading-and-math-by-education-level'),
  ('share-of-students-at-end-of-lower-secondary-education-achieving-minimum-math-proficiency'),
  ('share-of-the-world-population-with-at-least-basic-education'),
  ('total-outward-financial-flows-from-drug-trafficking'),
  ('uk-daily-covid-cases-7day-average'),
  ('weekly-covid-cases-per-million-people'),
  ('worldbank-per_allsp.adq_q5_pret_tot'),
  ('worldbank-per_allsp.avt_ep_pret_tot'),
  ('worldbank-per_allsp.avt_q1_pret_totmr'),
  ('worldbank-per_allsp.ben_q1_pret_tot'),
  ('worldbank-per_allsp.ben_q4_pret_tot'),
  ('worldbank-per_allsp.bry_q3_pret_totmr'),
  ('worldbank-per_allsp.bry_q5_pret_totfr'),
  ('worldbank-per_lm_alllm.avt_ep_pret_tot'),
  ('worldbank-per_lm_alllm.avt_pop_totmr'),
  ('worldbank-per_lm_alllm.avt_q4_pret_totfr'),
  ('worldbank-sg.vaw.npsv.1549.lt.me.zs'),
  -- Hand-picked anchors from 0026/0027.
  ('share-of-individuals-using-the-internet'),
  ('cost-of-sequencing-a-full-human-genome'),
  ('worldbank-eg.elc.accs.zs'),
  ('eurostat-tps00001'),
  ('eurostat-nama_10_gdp');

-- Fill the remaining allocation (hard ceiling: 80 assets) with the strongest
-- currently indexable pages by measured publisher engagement, then freshness.
WITH event_scores AS (
  SELECT
    asset_id,
    SUM(
      CASE event_type
        WHEN 'embed_copy' THEN 8
        WHEN 'citation_copy' THEN 6
        WHEN 'detail_view' THEN 4
        WHEN 'source_click' THEN 2
        WHEN 'impression' THEN 1
        ELSE 0
      END
    ) AS engagement_score
  FROM asset_events
  GROUP BY asset_id
),
fill AS (
  SELECT
    a.slug,
    ROW_NUMBER() OVER (
      ORDER BY
        COALESCE(event_scores.engagement_score, 0) DESC,
        COALESCE(a.source_updated_at, a.published_at, a.updated_at) DESC,
        LENGTH(TRIM(a.description)) DESC,
        a.id ASC
    ) AS fill_rank
  FROM assets a
  LEFT JOIN event_scores ON event_scores.asset_id = a.id
  WHERE a.search_indexable = 1
    AND a.slug NOT IN (SELECT slug FROM keep_indexable_slugs)
)
INSERT OR IGNORE INTO keep_indexable_slugs (slug)
SELECT slug
FROM fill
WHERE fill_rank <= MAX(
  0,
  80 - (
    SELECT COUNT(*)
    FROM assets
    WHERE search_indexable = 1
      AND slug IN (SELECT slug FROM keep_indexable_slugs)
  )
);

-- Only prune: never promote an asset that earlier quality gates excluded.
UPDATE assets
SET search_indexable = 0
WHERE search_indexable = 1
  AND slug NOT IN (SELECT slug FROM keep_indexable_slugs);

DROP TABLE keep_indexable_slugs;
