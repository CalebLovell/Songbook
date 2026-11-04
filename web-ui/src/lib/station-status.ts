import { createServerFn } from "@tanstack/react-start";

import { readStationStatus } from "./station-status.server.ts";

export type StationStatus = "live" | "offline" | "unknown";

export const getStationStatus = createServerFn({ method: "GET" }).handler(
	(): Promise<StationStatus> => readStationStatus(),
);
