import { speciesFuse } from "~/lib/species-fuse.ts";

export type SearchSpecies = { comName: string; sciName: string; count: number };

export type SearchPage = { label: string; to: string };

export type SearchSetting = {
	title: string;
	fields: string[];
	keywords?: string[];
};

type SettingMatch<S extends SearchSetting = SearchSetting> = {
	setting: S;
	field?: string;
};

export type SiteSearchResults<
	P extends SearchPage = SearchPage,
	S extends SearchSetting = SearchSetting,
> = {
	species: SearchSpecies[];
	pages: P[];
	settings: SettingMatch<S>[];
};

const MAX_SPECIES = 6;
const MAX_SETTINGS = 4;

function matchesWords(text: string, needles: string[]): boolean {
	const words = text.toLowerCase().split(/[\s-]+/);
	return needles.every((needle) =>
		words.some((word) => word.startsWith(needle)),
	);
}

export function searchSite<P extends SearchPage, S extends SearchSetting>(
	query: string,
	species: readonly SearchSpecies[],
	pages: readonly P[],
	settings: readonly S[] = [],
): SiteSearchResults<P, S> {
	const needle = query.trim().toLowerCase();
	if (needle === "") return { species: [], pages: [], settings: [] };
	const needles = needle.split(/\s+/);

	const fuse = speciesFuse(species);

	const settingMatches: SettingMatch<S>[] = [];
	for (const setting of settings) {
		if (
			matchesWords(setting.title, needles) ||
			setting.keywords?.some((keyword) => matchesWords(keyword, needles))
		) {
			settingMatches.push({ setting });
			continue;
		}
		const field = setting.fields.find((label) => matchesWords(label, needles));
		if (field) settingMatches.push({ setting, field });
	}

	return {
		species: fuse
			.search(needle, { limit: MAX_SPECIES })
			.map((result) => result.item),
		pages: pages.filter((page) => matchesWords(page.label, needles)),
		settings: settingMatches.slice(0, MAX_SETTINGS),
	};
}
