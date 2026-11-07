import { z } from "zod";

import { commonNameSafe } from "~/lib/audio.ts";
import { pageParam } from "~/lib/search-schema.ts";

export const reviewSearchSchema = z.object({ page: pageParam });
export type ReviewSearch = z.output<typeof reviewSearchSchema>;
export const REVIEW_PAGE_SIZE = 10;
export type SpeciesOption = { sciName: string; comName: string };

export function parseSpeciesCatalog(text: string): SpeciesOption[] {
	const parsed = JSON.parse(text) as Record<string, unknown>;
	return Object.entries(parsed)
		.filter(
			(entry): entry is [string, string] =>
				entry[0].trim().length > 0 &&
				typeof entry[1] === "string" &&
				entry[1].trim().length > 0,
		)
		.map(([sciName, comName]) => ({ sciName, comName }))
		.sort((a, b) => a.comName.localeCompare(b.comName));
}

export function recategorizedFileName(
	fileName: string,
	oldCommonName: string,
	newCommonName: string,
): string | null {
	const prefix = `${commonNameSafe(oldCommonName)}-`;
	return fileName.startsWith(prefix)
		? `${commonNameSafe(newCommonName)}-${fileName.slice(prefix.length)}`
		: null;
}
