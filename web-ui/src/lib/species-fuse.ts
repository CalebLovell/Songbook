import Fuse from "fuse.js";

const SPECIES_MATCH_THRESHOLD = 0.15;

export function speciesFuse<T extends { comName: string; sciName: string }>(
	species: readonly T[],
): Fuse<T> {
	return new Fuse(species, {
		keys: ["comName", "sciName"],
		threshold: SPECIES_MATCH_THRESHOLD,
		ignoreLocation: true,
	});
}
