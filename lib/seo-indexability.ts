import type { Metadata } from "next";

export type SeoSearchParams = Record<string, string | string[] | undefined>;

export const NOINDEX_FOLLOW: NonNullable<Metadata["robots"]> = {
  index: false,
  follow: true,
};

export function hasQueryParameters(searchParams: SeoSearchParams): boolean {
  return Object.keys(searchParams).length > 0;
}

export function getPageNumber(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  return Math.max(1, Number.parseInt(raw ?? "1", 10) || 1);
}

/**
 * Listing pages are indexable only in their clean URL form. Empty result pages
 * stay out of the index unless the route contains substantive editorial copy.
 */
export function getListingRobots(
  searchParams: SeoSearchParams,
  resultCount: number,
  allowEmpty: boolean = false,
): Metadata["robots"] {
  if (hasQueryParameters(searchParams) || (!allowEmpty && resultCount <= 0)) {
    return NOINDEX_FOLLOW;
  }
  return undefined;
}
