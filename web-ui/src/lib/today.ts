import { createServerFn } from "@tanstack/react-start";
import { desc, eq, sql } from "drizzle-orm";

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

export type CurrentBird = {
	key: string;
	comName: string;
	sciName: string;
	speciesSlug: string;
	imageUrl: string | null;
	detectedAt: string;
	ageMs: number;
	confidence: number | null;
	audioUrl: string | null;
};

export type RecentVisit = {
	key: string;
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
	current: CurrentBird | null;
	hasAnyDetections: boolean;
	day: ShownDay;
	date: string;
	recent: RecentVisit[];
};

export const RECENT_LIMIT = 6;

type LatestRow = {
	comName: string;
	sciName: string;
	date: string;
	detectedAt: string;
	confidence: number | null;
	fileName: string;
};

function buildCurrentBird(
	latest: LatestRow,
	withAudio: boolean,
): Omit<CurrentBird, "ageMs"> {
	return {
		key: detectionKeyOf(latest) ?? "",
		comName: latest.comName,
		sciName: latest.sciName,
		speciesSlug: comNameToSlug(latest.comName),
		imageUrl: illustrationUrlFor(latest.sciName, "flight"),
		detectedAt: latest.detectedAt,
		confidence: latest.confidence,
		audioUrl: withAudio
			? audioUrlFor(latest.date, latest.comName, latest.fileName)
			: null,
	};
}

const detectionColumns = {
	comName: detections.Com_Name,
	sciName: detections.Sci_Name,
	date: detections.Date,
	detectedAt,
	confidence: detections.Confidence,
	fileName: detections.File_Name,
};

async function latestOn(date: string): Promise<LatestRow | undefined> {
	const [row] = await db
		.select(detectionColumns)
		.from(detections)
		.where(eq(detections.Date, date))
		.orderBy(desc(detections.Date), desc(detections.Time))
		.limit(1);
	return row;
}

async function recentOn(
	date: string,
	heroKey: string | undefined,
	withAudio: boolean,
): Promise<Omit<RecentVisit, "ageMs">[]> {
	const rows = await db
		.select(detectionColumns)
		.from(detections)
		.where(eq(detections.Date, date));
	const visits = groupVisits(
		rows.map((row) => ({ ...row, timestamp: row.detectedAt })),
	).filter((visit) => detectionKeyOf(visit.moments.at(-1)) !== heroKey);
	return visits.slice(0, RECENT_LIMIT).map((visit) => {
		const first = visit.moments[0];
		const last = visit.moments[visit.moments.length - 1];
		const best = visit.moments.reduce((top, moment) =>
			(moment.confidence ?? -1) > (top.confidence ?? -1) ? moment : top,
		);
		return {
			key: `${visit.comName}-${first.detectedAt}`,
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

function detectionKeyOf(row: LatestRow | undefined): string | undefined {
	return row && `${row.detectedAt}-${row.fileName}`;
}

async function hasAnyDetections(): Promise<boolean> {
	const [row] = await db
		.select({ rowId: sql<number>`rowid` })
		.from(detections)
		.limit(1);
	return row !== undefined;
}

async function readShownDay() {
	const today = stationToday();
	const latestToday = await latestOn(today);
	if (latestToday)
		return { day: "today" as const, date: today, latest: latestToday };
	const yesterday = addDays(today, -1);
	return {
		day: "yesterday" as const,
		date: yesterday,
		latest: await latestOn(yesterday),
	};
}

async function loadNowData(withAudio: boolean) {
	const { day, date, latest } = await readShownDay();
	return {
		current: latest ? buildCurrentBird(latest, withAudio) : null,
		hasAnyDetections: latest ? true : await hasAnyDetections(),
		day,
		date,
		recent: latest
			? await recentOn(date, detectionKeyOf(latest), withAudio)
			: [],
	};
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
		const { current, recent, ...rest } = await readNowData(
			await canHearEveryClip(),
		);
		const ageOf = (timestamp: string) =>
			generatedAtDate.getTime() - timestampToMillis(timestamp);

		return {
			generatedAt: localTimestamp(generatedAtDate),
			current: current && { ...current, ageMs: ageOf(current.detectedAt) },
			recent: recent.map((visit) => ({
				...visit,
				ageMs: ageOf(visit.lastAt),
			})),
			...rest,
		};
	},
);
