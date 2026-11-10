import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { readStationStatus } from "./station-status.server.ts";

export type StationStatus = "live" | "offline" | "unknown";

export const getStationStatus = createServerFn({ method: "GET" }).handler(
	(): Promise<StationStatus> => readStationStatus(),
);

const STATUS_INTERVAL_MS = 30_000;

export const stationStatusQuery = queryOptions({
	queryKey: ["station-status"],
	queryFn: () => getStationStatus(),
	refetchInterval: STATUS_INTERVAL_MS,
});
