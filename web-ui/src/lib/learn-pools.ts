export const LEARN_POOLS = ["common", "uncommon", "rare", "all"] as const;
export type LearnPool = (typeof LEARN_POOLS)[number];

export type FamiliarityPool = Exclude<LearnPool, "all">;

export const LEARN_POOL_LABELS: Record<LearnPool, string> = {
	common: "Common",
	uncommon: "Uncommon",
	rare: "Rare",
	all: "All",
};

export const COMMON_SPECIES_OVER = 100;

function commonOver(rareMax: number) {
	return Math.max(COMMON_SPECIES_OVER, rareMax);
}

export function familiarityPool(
	detections: number,
	rareMax: number,
): FamiliarityPool {
	if (detections <= rareMax) return "rare";
	if (detections > commonOver(rareMax)) return "common";
	return "uncommon";
}

export function learnPoolMeanings(rareMax: number): Record<LearnPool, string> {
	const common = commonOver(rareMax);
	return {
		common: `species heard more than ${common} times.`,
		uncommon: `species heard ${rareMax + 1} to ${common} times.`,
		rare: `species heard ${rareMax} or fewer times.`,
		all: "every species with a clip to play.",
	};
}
