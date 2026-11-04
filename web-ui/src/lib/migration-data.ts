export type MarkerDetection = {
	detectedAt: string;
	ageMs: number;
	confidence: number | null;
	audioUrl: string | null;
};

export type QuietSpecies = MarkerDetection & {
	comName: string;
	sciName: string;
	count: number;
	lastSeen: string;
	imageUrl: string | null;
};

export type ArrivalSpecies = MarkerDetection & {
	comName: string;
	sciName: string;
	count: number;
	firstSeen: string;
	imageUrl: string | null;
};

export const QUIET_AFTER_DAYS = 14;

export const ARRIVAL_WINDOW_DAYS = 14;

export const RESIDENT_MIN_DAYS = 5;

export const MIGRATION_LIST_LIMIT = 10;

const SHORT_DATE = new Intl.DateTimeFormat("en-US", {
	month: "short",
	day: "numeric",
	timeZone: "UTC",
});

export function shortDateLabel(isoDate: string): string {
	const parsed = new Date(`${isoDate}T00:00:00Z`);
	return Number.isNaN(parsed.getTime()) ? isoDate : SHORT_DATE.format(parsed);
}
