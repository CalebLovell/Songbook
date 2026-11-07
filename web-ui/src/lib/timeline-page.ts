import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { dayIdFor, isDayId } from "~/lib/day.ts";
import type { HighlightThresholds } from "~/lib/highlight-thresholds.ts";
import { readHighlightThresholds } from "~/lib/settings-config.server.ts";
import { readStationLocation } from "~/lib/station-location.server.ts";
import { sampleDays, type WindowSun, windowSun } from "~/lib/sun-times.ts";
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

type TimelineBody =
	| {
			kind: "rows";
			rows: TimelineRow[];
			highlights: TimelineData["highlights"];
			thresholds: HighlightThresholds;
			sun: WindowSun;
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

		const [thresholds, location] = await Promise.all([
			readHighlightThresholds(),
			readStationLocation(),
		]);
		const { rows, highlights, ...nav } = await loadTimelineData({
			period,
			anchor,
			settings: thresholds,
		});
		const sun: WindowSun = location
			? windowSun(
					sunDays(nav),
					location.latitude,
					location.longitude,
					location.timezone,
				)
			: { available: false, reason: "no-location" };
		return {
			...nav,
			period,
			body: { kind: "rows", rows, highlights, thresholds, sun },
		};
	});

function sunDays(nav: TimelineNav): string[] {
	if (nav.window) {
		const today = dayIdFor(new Date());
		const end = nav.window.end > today ? today : nav.window.end;
		return end >= nav.window.start
			? sampleDays(nav.window.start, end)
			: sampleDays(nav.window.start, nav.window.end);
	}
	return nav.stationRange
		? sampleDays(nav.stationRange.first, nav.stationRange.last)
		: [];
}
