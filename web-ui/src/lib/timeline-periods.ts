export const TIMELINE_PERIODS = [
	"day",
	"week",
	"month",
	"year",
	"all",
] as const;
export type TimelinePeriod = (typeof TIMELINE_PERIODS)[number];

export const TIMELINE_PERIOD_LABELS: Record<TimelinePeriod, string> = {
	day: "Daily",
	week: "Weekly",
	month: "Monthly",
	year: "Yearly",
	all: "All Time",
};
