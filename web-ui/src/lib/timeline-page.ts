import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { isDayId } from "~/lib/day.ts";
import type { HighlightThresholds } from "~/lib/highlight-thresholds.ts";
import { readHighlightThresholds } from "~/lib/settings-config.server.ts";
import {
	loadTimelineData,
	loadTimelineNav,
	type TimelineData,
	type TimelineNav,
	type TimelineRow,
} from "~/lib/timeline.ts";
import {
	TIMELINE_PERIODS,
	type TimelinePeriod,
} from "~/lib/timeline-periods.ts";
import type { TimelineAnchor } from "~/lib/timeline-window.ts";

export type TimelinePageRequest = {
	period: TimelinePeriod;
	anchor: TimelineAnchor;
};

export type TimelineBody =
	| {
			kind: "rows";
			rows: TimelineRow[];
			highlights: TimelineData["highlights"];
			thresholds: HighlightThresholds;
	  }
	| { kind: "not-a-date" };

export type TimelinePageData = TimelineNav & {
	period: TimelinePeriod;
	body: TimelineBody;
};

export const getTimelinePage = createServerFn({ method: "GET" })
	.validator(
		z.object({
			period: z.enum(TIMELINE_PERIODS),
			anchor: z.string().max(32),
		}) satisfies z.ZodType<TimelinePageRequest>,
	)
	.handler(async ({ data: { period, anchor } }): Promise<TimelinePageData> => {
		if (period === "day" && !isDayId(anchor)) {
			const nav = await loadTimelineNav("day", null);
			return { ...nav, period, body: { kind: "not-a-date" } };
		}

		const thresholds = await readHighlightThresholds();
		const { rows, highlights, ...nav } = await loadTimelineData({
			period,
			anchor,
			settings: thresholds,
		});
		return {
			...nav,
			period,
			body: { kind: "rows", rows, highlights, thresholds },
		};
	});
