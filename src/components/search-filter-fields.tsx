"use client";

import Link from "next/link";

import {
  assetTypeOptions,
  freshnessOptions,
  type ParsedSearchPage,
  type SearchSourceOption,
} from "@/lib/search/search-page";

type SearchFilterFieldsProps = {
  formId: string;
  parsed: Pick<
    ParsedSearchPage,
    | "selectedAssetTypes"
    | "selectedSource"
    | "selectedRights"
    | "commercialUseOnly"
    | "selectedFreshness"
  >;
  sourceOptions: SearchSourceOption[];
};

function submitFilters(form: HTMLFormElement | null) {
  form?.requestSubmit();
}

export function SearchFilterFields({
  formId,
  parsed,
  sourceOptions: availableSources,
}: SearchFilterFieldsProps) {
  return (
    <div className="filter-groups">
      <div className="filter-header">
        <h2>Filters</h2>
        <Link href="/search">Clear</Link>
      </div>
      <fieldset className="filter-group">
        <legend>Asset type</legend>
        {assetTypeOptions.map((option) => (
          <label className="filter-option" key={option.value}>
            <input
              defaultChecked={parsed.selectedAssetTypes.includes(option.value)}
              form={formId}
              onChange={(event) => submitFilters(event.currentTarget.form)}
              name="type"
              type="checkbox"
              value={option.value}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </fieldset>
      <fieldset className="filter-group">
        <legend>Source</legend>
        <select
          aria-label="Filter by source"
          defaultValue={parsed.selectedSource}
          form={formId}
          name="source"
          onChange={(event) => submitFilters(event.currentTarget.form)}
        >
          <option value="">All sources</option>
          {availableSources.map((option) => (
            <option key={option.value} value={option.value}>
              {option.count ? `${option.label} (${option.count.toLocaleString()})` : option.label}
            </option>
          ))}
        </select>
      </fieldset>
      <fieldset className="filter-group">
        <legend>Commercial use</legend>
        <label className="filter-option">
          <input
            defaultChecked={parsed.commercialUseOnly}
            form={formId}
            onChange={(event) => submitFilters(event.currentTarget.form)}
            name="commercial"
            type="checkbox"
            value="allowed"
          />
          <span>Commercial use allowed</span>
        </label>
      </fieldset>
      <fieldset className="filter-group">
        <legend>Rights review</legend>
        <label className="filter-option">
          <input
            defaultChecked={parsed.selectedRights.includes("safe")}
            form={formId}
            onChange={(event) => submitFilters(event.currentTarget.form)}
            name="rights"
            type="checkbox"
            value="safe"
          />
          <span>Source rights reviewed</span>
        </label>
        <label className="filter-option">
          <input
            defaultChecked={parsed.selectedRights.includes("restricted")}
            form={formId}
            onChange={(event) => submitFilters(event.currentTarget.form)}
            name="rights"
            type="checkbox"
            value="restricted"
          />
          <span>Creator-attested or restricted</span>
        </label>
      </fieldset>
      <fieldset className="filter-group">
        <legend>Freshness</legend>
        {freshnessOptions.map((option) => (
          <label className="filter-option" key={option.value}>
            <input
              defaultChecked={parsed.selectedFreshness === option.value}
              form={formId}
              onChange={(event) => submitFilters(event.currentTarget.form)}
              name="freshness"
              type="radio"
              value={option.value}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </fieldset>
    </div>
  );
}
