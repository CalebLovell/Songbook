import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { sqlite } from "~/db/index.ts";
import { hearableRecordings } from "~/lib/clip-access.server.ts";
import { illustrationUrlFor } from "~/lib/illustrations.ts";
import {
	commonMinimum,
	familiarityPool,
	LEARN_POOLS,
	type LearnPool,
	type PoolThresholds,
	SETTLING_DAYS,
} from "~/lib/learn-pools.ts";
import {
	buildRound,
	type LearnRound,
	type PoolSpecies,
} from "~/lib/learn-round.ts";
import { readHighlightThresholds } from "~/lib/settings-config.server.ts";
import { comNameToSlug } from "~/lib/species-slug.ts";

const MINIMUM_CLIP_CONFIDENCE = 0.65;

function allTimeDetections(): Map<string, number> {
	const rows = sqlite
		.prepare(
			"SELECT Com_Name AS comName, COUNT(*) AS detections FROM detections GROUP BY Com_Name",
		)
		.all() as { comName: string; detections: number }[];
	return new Map(rows.map((row) => [row.comName, row.detections]));
}

function daysWithDetections(): number {
	const row = sqlite
		.prepare("SELECT COUNT(DISTINCT Date) AS days FROM detections")
		.get() as { days: number } | undefined;
	return row?.days ?? 0;
}

function inPool(
	pool: LearnPool,
	species: PoolSpecies,
	detections: Map<string, number>,
	thresholds: PoolThresholds,
): boolean {
	if (pool === "all") return true;
	return (
		familiarityPool(detections.get(species.comName) ?? 0, thresholds) === pool
	);
}

async function playableSpecies(): Promise<PoolSpecies[]> {
	return [...(await hearableRecordings()).values()]
		.filter((clip) => (clip.confidence ?? 0) >= MINIMUM_CLIP_CONFIDENCE)
		.map((clip) => ({
			comName: clip.comName,
			sciName: clip.sciName,
			speciesSlug: comNameToSlug(clip.comName),
			imageUrl: illustrationUrlFor(clip.sciName),
			clips: [
				{
					date: clip.date,
					fileName: clip.fileName,
					detectedAt: `${clip.date} ${clip.time}`,
					confidence: clip.confidence,
				},
			],
		}));
}

function addSpeciesStats(round: LearnRound): LearnRound {
	const names = [
		...new Set(
			round.questions.flatMap((question) =>
				question.choices.map((choice) => choice.comName),
			),
		),
	];
	if (names.length === 0) return round;

	const rows = sqlite
		.prepare(
			`SELECT Com_Name AS comName, COUNT(*) AS detections, MIN(Date) AS firstHeard
			FROM detections
			WHERE Com_Name IN (${names.map(() => "?").join(", ")})
			GROUP BY Com_Name`,
		)
		.all(...names) as {
		comName: string;
		detections: number;
		firstHeard: string | null;
	}[];
	const stats = new Map(rows.map((row) => [row.comName, row]));

	return {
		...round,
		questions: round.questions.map((question) => ({
			...question,
			choices: question.choices.map((choice) => ({
				...choice,
				detections: stats.get(choice.comName)?.detections ?? 0,
				firstHeard: stats.get(choice.comName)?.firstHeard ?? null,
			})),
		})),
	};
}

export type LearnRoundData = {
	pool: LearnPool;
	round: LearnRound;
	hasAnyDetections: boolean;
	isSettling: boolean;
	poolCounts: Record<LearnPool, number>;
	thresholds: PoolThresholds;
};

export const getLearnRound = createServerFn({ method: "GET" })
	.validator(z.enum(LEARN_POOLS).nullable())
	.handler(async ({ data: chosenPool }): Promise<LearnRoundData> => {
		const playable = await playableSpecies();
		const detections = allTimeDetections();
		const { rareMax } = await readHighlightThresholds();
		const thresholds: PoolThresholds = {
			rareMax,
			commonMin: commonMinimum(detections.values(), rareMax),
		};
		const isSettling = daysWithDetections() < SETTLING_DAYS;
		const pool = chosenPool ?? (isSettling ? "all" : "common");
		const poolCounts = Object.fromEntries(
			LEARN_POOLS.map((option) => [
				option,
				playable.filter((species) =>
					inPool(option, species, detections, thresholds),
				).length,
			]),
		) as Record<LearnPool, number>;

		const round = addSpeciesStats(
			buildRound(
				playable.filter((species) =>
					inPool(pool, species, detections, thresholds),
				),
			),
		);

		return {
			pool,
			round,
			hasAnyDetections: detections.size > 0,
			isSettling,
			poolCounts,
			thresholds,
		};
	});
