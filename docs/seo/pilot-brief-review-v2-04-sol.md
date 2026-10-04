# V2-04 Sol review of the three pilot briefs

**Review date:** 4 October 2026  
**Decision:** approved for V2-05 implementation, not publication  
**Production changes:** none

## Outcome

All three briefs now have a defined question, answer boundary, source identity, unit, period, transformation, material limitations, rights actions and internal-link intent. The two OWID evidence gaps identified in the Luna first pass were resolved through read-only retrieval of the official chart metadata, CSV data and indicator metadata.

The retrieved OWID files were used only for this review and were not added as production content. Their URLs and SHA-256 hashes are recorded in [pilot-brief-review-v2-04-sol.json](../../data/seo/pilot-brief-review-v2-04-sol.json). V2-06 must turn the approved inputs into repository fixtures and deterministic assertions before release.

## Decisions

### Fossil-fuel reserves

Approved for overlay implementation with a strict time-context warning.

The chart is a world-level reserves-to-production ratio in years. Our World in Data calculates it as proved reserves divided by production of the same fuel in the same year. Gas and oil run from 1980 through 2020; coal contains only a 2020 observation. The 2020 values are 48.503418 years for gas, 140.34598 for coal and 56.391872 for oil.

The page must not call these current values or present them as depletion dates. The source metadata was updated in 2026, but the observations shown by this chart stop in 2020. Coal cannot support a trend because only one observation is present.

The OWID chart may be cited and source-hosted as an embed under the chart's CC BY presentation license. Raw-data redistribution is not approved here because the underlying Energy Institute origins retain provider-specific copyright terms.

### Solar photovoltaic module prices

Approved for overlay implementation.

The reviewed series covers 1975–2024 and is expressed in constant 2025 US dollars per watt. It falls from 132.3757 dollars per watt in 1975 to 0.26518628 in 2024, approximately 99.8% lower. That calculation is approved provided the start year, end year, unit and inflation basis remain visible.

The limitation is central: the series combines Nemet for 1975–2003, Farmer and Lafond for 2004–2009, and IRENA from 2010 onward. The later observations use European pvXchange benchmarks because of limited global data. It measures the module itself, not installation, balance-of-system costs, generation costs or electricity prices.

The chart may be cited and source-hosted as an embed. Raw-data redistribution remains unapproved because the underlying inputs have mixed provider terms.

### Eurostat renewable-energy indicators

Approved for overlay implementation while retaining `noindex, follow`.

The approved scope is `EU27_2020`, annual data for 2020–2024, unit percentage, and the four categories `REN`, `REN_TRA`, `REN_ELC` and `REN_HEAT_CL`. The 2024 observations are 25.241%, 11.2%, 47.503% and 26.738% respectively. Display rounding to one decimal place is allowed.

The categories have different denominators and must not be added. The 2020–2021 methodology break must be visible whenever a trend is described. The asset page remains a narrow dataset reference and should link to, rather than duplicate, the broader EU-renewables insight.

The source-hosted embed remains disabled. The marketplace-rendered embed, citation and attributed Eurostat data presentation remain the approved actions.

## Rights boundary

Chart reuse and raw-data redistribution are separate decisions. Both OWID pages expose a CC BY license for the OWID chart presentation, but their underlying source records include provider-specific terms. V2-05 must preserve the current source-hosted embed and citation actions while leaving raw-data redistribution unavailable.

For Eurostat, the existing reviewed policy permits the marketplace-rendered presentation and attributed raw-data reuse subject to Eurostat's policy exceptions. It does not permit a source-hosted embed in the current asset contract.

## Release boundary

This review authorizes V2-05 to implement the overlay schema, loader and reviewed visible sections for the three pilots. It does not authorize production publication.

Before release:

1. V2-06 must store and test the exact approved source fixtures;
2. chart and table values must derive from the same fixture;
3. stale-source behavior must fail closed;
4. rights actions must match each source contract;
5. V2-07 must complete technical, accessibility, responsive, metadata and browser QA;
6. the Eurostat asset must remain outside the sitemap until the explicit indexability gate passes.

No D1 read or write, asset mutation, indexability change, commit or deployment was performed in this review.
