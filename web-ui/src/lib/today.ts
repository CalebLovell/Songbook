import { createServerFn } from "@tanstack/react-start";
import { eq, sql } from "drizzle-orm";

import { dataVersion, db } from "~/db/index.ts";
import { detections } from "~/db/schema.ts";
import { audioUrlFor } from "~/lib/audio.ts";
import { canHearEveryClip } from "~/lib/clip-access.server.ts";
import { illustrationUrlFor } from "~/lib/illustrations.ts";
import { shareRead } from "~/lib/shared-read.ts";
import { comNameToSlug } from "~/lib/species-slug.ts";
import { stationToday } from "~/lib/station-time.ts";
import { addDays } from "~/lib/timeline-window.ts";
import {
	groupVisits,
	localTimestamp,
	timestampToMillis,
} from "~/lib/visits.ts";

const detectedAt = sql<string>`datetime(${detections.Date} || ' ' || ${detections.Time})`;

export type ShownDay = "today" | "yesterday";

export type DayVisit = {
	key: string;
	latestKey: string;
	comName: string;
	sciName: string;
	speciesSlug: string;
	imageUrl: string | null;
	firstAt: string;
	lastAt: string;
	ageMs: number;
	detections: number;
	confidence: number | null;
	audioUrl: string | null;
};

export type TodaySnapshot = {
	generatedAt: string;
	day: ShownDay;
	date: string;
	visits: DayVisit[];
};

const detectionColumns = {
	comName: detections.Com_Name,
	sciName: detections.Sci_Name,
	date: detections.Date,
	detectedAt,
	confidence: detections.Confidence,
	fileName: detections.File_Name,
};

async function visitsOn(
	date: string,
	withAudio: boolean,
): Promise<Omit<DayVisit, "ageMs">[]> {
	const rows = await db
		.select(detectionColumns)
		.from(detections)
		.where(eq(detections.Date, date));
	const visits = groupVisits(
		rows.map((row) => ({ ...row, timestamp: row.detectedAt })),
	);
	return visits.map((visit) => {
		const first = visit.moments[0];
		const last = visit.moments[visit.moments.length - 1];
		const best = visit.moments.reduce((top, moment) =>
			(moment.confidence ?? -1) > (top.confidence ?? -1) ? moment : top,
		);
		return {
			key: `${visit.comName}-${first.detectedAt}`,
			latestKey: `${last.detectedAt}-${last.fileName}`,
			comName: visit.comName,
			sciName: last.sciName,
			speciesSlug: comNameToSlug(visit.comName),
			imageUrl: illustrationUrlFor(last.sciName, "perched"),
			firstAt: first.detectedAt,
			lastAt: last.detectedAt,
			detections: visit.moments.length,
			confidence: best.confidence,
			audioUrl: withAudio
				? audioUrlFor(best.date, best.comName, best.fileName)
				: null,
		};
	});
}

async function loadNowData(withAudio: boolean) {
	const today = stationToday();
	const heardToday = await visitsOn(today, withAudio);
	if (heardToday.length > 0)
		return { day: "today" as const, date: today, visits: heardToday };
	const yesterday = addDays(today, -1);
	const heardYesterday = await visitsOn(yesterday, withAudio);
	if (heardYesterday.length > 0)
		return {
			day: "yesterday" as const,
			date: yesterday,
			visits: heardYesterday,
		};
	return { day: "today" as const, date: today, visits: [] };
}

const NOW_DATA_MAX_AGE_MS = 60_000;

const nowDataReads = new Map<boolean, () => ReturnType<typeof loadNowData>>();

function readNowData(withAudio: boolean) {
	let read = nowDataReads.get(withAudio);
	if (!read) {
		read = shareRead(() => loadNowData(withAudio), {
			maxAgeMs: NOW_DATA_MAX_AGE_MS,
			version: dataVersion,
		});
		nowDataReads.set(withAudio, read);
	}
	return read();
}

export const getTodaySnapshot = createServerFn({ method: "GET" }).handler(
	async (): Promise<TodaySnapshot> => {
		const generatedAtDate = new Date();
		const { visits, ...rest } = await readNowData(await canHearEveryClip());
		const ageOf = (timestamp: string) =>
			generatedAtDate.getTime() - timestampToMillis(timestamp);

		return {
			generatedAt: localTimestamp(generatedAtDate),
			visits: visits.map((visit) => ({
				...visit,
				ageMs: ageOf(visit.lastAt),
			})),
			...rest,
		};
	},
);
