import ebirdCodes from "~/lib/ebird-codes.json";
import inaturalistTaxa from "~/lib/inaturalist-taxa.json";

const EBIRD_CODES: Record<string, string> = {
	...ebirdCodes,
	"Amblyornis newtoniana": "golbow1",
	"Brachypodius melanocephalos": "blhbul1",
	"Leucolia violiceps": "vichum",
};

const INATURALIST_TAXA: Record<string, number> = inaturalistTaxa;

const SOUND_CLASSES = new Set([
	"Dog",
	"Engine",
	"Environmental",
	"Fireworks",
	"Gun",
	"Human",
	"Human non-vocal",
	"Human vocal",
	"Human whistle",
	"Noise",
	"Non-Bird",
	"Power tools",
	"Siren",
]);

export type SpeciesLink = { href: string; site: "eBird" | "iNaturalist" };

export function speciesLinkFor(sciName: string): SpeciesLink | null {
	const code = EBIRD_CODES[sciName];
	if (code) return { href: `https://ebird.org/species/${code}`, site: "eBird" };
	if (SOUND_CLASSES.has(sciName)) return null;
	const taxon = INATURALIST_TAXA[sciName];
	const href = taxon
		? `https://www.inaturalist.org/taxa/${taxon}`
		: `https://www.inaturalist.org/taxa/search?q=${encodeURIComponent(sciName)}`;
	return { href, site: "iNaturalist" };
}
