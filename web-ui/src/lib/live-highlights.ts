import { createServerFn } from "@tanstack/react-start";

import {
	type HighlightThresholds,
	lookbackFor,
} from "~/lib/highlight-thresholds.ts";
import { type Highlight, judgeHighlights } from "~/lib/highlights-data.ts";
import { readLiveTallies } from "~/lib/live-highlights.server.ts";
import { readHighlightThresholds } from "~/lib/settings-config.server.ts";
import { timestampToMillis } from "~/lib/visits.ts";

const DAY_MS = 24 * 60 * 60 * 1000;

export type LiveHighlights = {
	hasAnyDetections: boolean;
	highlights: Highlight[];
	thresholds: HighlightThresholds;
};

export const getLiveHighlights = createServerFn({ method: "GET" }).handler(
	async (): Promise<LiveHighlights> => {
		const settings = await readHighlightThresholds();
		const nowMs = Date.now();
		const longest = Math.max(
			1,
			lookbackFor(settings.goneQuiet, "live"),
			lookbackFor(settings.returned, "live"),
			lookbackFor(settings.vocal, "live"),
		);

		const {
			hasAnyDetections,
			slices,
			firstInWindow,
			history,
			daysBefore,
			hourCounts,
		} = await readLiveTallies(longest);

		if (!hasAnyDetections) {
			return {
				hasAnyDetections: false,
				highlights: [],
				thresholds: settings,
			};
		}

		const daysBetween = (fromMs: number, toMs: number) =>
			Math.floor((toMs - fromMs) / DAY_MS);
		const lifetime = new Map<string, number>();
		const awayDays = new Map<string, number>();
		const silentDays = new Map<string, number>();
		for (const [comName, { countBefore, lastBefore }] of history) {
			const lastMs = timestampToMillis(lastBefore);
			const first = firstInWindow.get(comName);
			lifetime.set(comName, countBefore + (slices[0].get(comName) ?? 0));
			if (first)
				awayDays.set(comName, daysBetween(lastMs, timestampToMillis(first)));
			else silentDays.set(comName, daysBetween(lastMs, nowMs));
		}
		for (const [comName, n] of slices[0])
			if (!lifetime.has(comName)) lifetime.set(comName, n);

		const { highlights } = judgeHighlights(
			{
				period: "live",
				window: [slices[0]],
				inProgress: false,
				before: slices.slice(1).map((slice) => [slice]),
				daysBefore,
				hourCounts,
				lifetime,
				heardBefore: new Set(history.keys()),
				awayDays,
				silentDays,
			},
			settings,
		);

		return { hasAnyDetections: true, highlights, thresholds: settings };
	},
);
