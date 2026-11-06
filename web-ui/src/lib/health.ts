import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { requireUnlocked } from "./auth.ts";
import { loadStationHealth } from "./health.server.ts";

export const getStationHealth = createServerFn({ method: "GET" })
	.middleware([requireUnlocked])
	.handler(() => loadStationHealth());

export const stationHealthQuery = queryOptions({
	queryKey: ["station-health"],
	queryFn: () => getStationHealth(),
});
