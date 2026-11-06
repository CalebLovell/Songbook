export const STATS_PERIODS = ["year", "all"] as const;
export type StatsPeriod = (typeof STATS_PERIODS)[number];
