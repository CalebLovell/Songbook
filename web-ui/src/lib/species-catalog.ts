import { comNameToSlug } from "~/lib/species-slug.ts";

export type CatalogSpecies = { sciName: string; comName: string };

export function findCatalogSpeciesBySlug(
	slug: string,
	catalog: readonly CatalogSpecies[],
): CatalogSpecies | null {
	if (slug === "") return null;
	return catalog.find((item) => comNameToSlug(item.comName) === slug) ?? null;
}
