export const LEARN_POOLS = ["common", "uncommon", "rare", "all"] as const;
export type LearnPool = (typeof LEARN_POOLS)[number];

export type FamiliarityPool = Exclude<LearnPool, "all">;

export const LEARN_POOL_LABELS: Record<LearnPool, string> = {
	common: "Common",
	uncommon: "Uncommon",
	rare: "Rare",
	all: "All",
};

export const COMMON_SHARE = 1 / 3;
export const COMMON_FLOOR = 20;
export const SETTLING_DAYS = 7;

export type PoolThresholds = {
	rareMax: number;
	commonMin: number;
};

export function commonMinimum(
	detectionCounts: Iterable<number>,
	rareMax: number,
): number {
	const lowest = Math.max(COMMON_FLOOR, rareMax + 1);
	const ranked = [...detectionCounts]
		.filter((count) => count > rareMax)
		.sort((a, b) => b - a);
	const cutoff = ranked[Math.ceil(ranked.length * COMMON_SHARE) - 1];
	return Math.max(lowest, cutoff ?? lowest);
}

export function familiarityPool(
	detections: number,
	{ rareMax, commonMin }: PoolThresholds,
): FamiliarityPool {
	if (detections <= rareMax) return "rare";
	if (detections >= commonMin) return "common";
	return "uncommon";
}

export function learnPoolMeanings(
	thresholds: PoolThresholds | null,
): Record<LearnPool, string> {
	const all = "every species with a clip to play.";
	if (!thresholds) {
		return {
			common: "the most-heard third of species at this station.",
			uncommon: "species between rare and common.",
			rare: "species heard only a handful of times.",
			all,
		};
	}
	const { rareMax, commonMin } = thresholds;
	return {
		common: `the most-heard third of species at this station, now those heard ${commonMin} or more times.`,
		uncommon:
			commonMin - 1 > rareMax
				? `species heard ${rareMax + 1} to ${commonMin - 1} times.`
				: "none yet: every species past rare is common.",
		rare: `species heard ${rareMax} or fewer times.`,
		all,
	};
}
