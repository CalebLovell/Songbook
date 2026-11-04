import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { sqlite } from "~/db/index.ts";
import { extractedDir } from "~/lib/audio.server.ts";
import { bestRecordings } from "~/lib/best-recording.server.ts";
import { illustrationUrlFor } from "~/lib/illustrations.ts";
import {
	familiarityPool,
	LEARN_POOLS,
	type LearnPool,
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

function inPool(
	pool: LearnPool,
	species: PoolSpecies,
	detections: Map<string, number>,
	rareMax: number,
): boolean {
	if (pool === "all") return true;
	return (
		familiarityPool(detections.get(species.comName) ?? 0, rareMax) === pool
	);
}

function playableSpecies(): PoolSpecies[] {
	return [...bestRecordings(sqlite, extractedDir()).values()]
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
	round: LearnRound;
	hasAnyDetections: boolean;
	poolCounts: Record<LearnPool, number>;
	rareMax: number;
};

export const getLearnRound = createServerFn({ method: "GET" })
	.validator(z.enum(LEARN_POOLS))
	.handler(async ({ data: pool }): Promise<LearnRoundData> => {
		const playable = playableSpecies();
		const detections = allTimeDetections();
		const { rareMax } = await readHighlightThresholds();
		const poolCounts = Object.fromEntries(
			LEARN_POOLS.map((option) => [
				option,
				playable.filter((species) =>
					inPool(option, species, detections, rareMax),
				).length,
			]),
		) as Record<LearnPool, number>;

		const round = addSpeciesStats(
			buildRound(
				playable.filter((species) =>
					inPool(pool, species, detections, rareMax),
				),
			),
		);

		return {
			round,
			hasAnyDetections: detections.size > 0,
			poolCounts,
			rareMax,
		};
	});
