import { type QueryClient, queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { APP_VERSION } from "./app-version.ts";
import { newerRelease } from "./release-data.ts";

const RELEASE_CHECK_MS = 5 * 60_000;
const RELOADED_FOR_KEY = "songbook-reloaded-for";

const getStationRelease = createServerFn({ method: "GET" }).handler(
	() => APP_VERSION,
);

export const stationReleaseQuery = queryOptions({
	queryKey: ["station-release"],
	queryFn: () => getStationRelease(),
	staleTime: 60_000,
	refetchInterval: RELEASE_CHECK_MS,
	refetchIntervalInBackground: true,
	refetchOnWindowFocus: true,
});

export function newerStationRelease(queryClient: QueryClient): string | null {
	return newerRelease(
		APP_VERSION,
		queryClient.getQueryData(stationReleaseQuery.queryKey) ?? null,
	);
}

export function reloadForRelease(version: string) {
	try {
		if (sessionStorage.getItem(RELOADED_FOR_KEY) === version) return;
		sessionStorage.setItem(RELOADED_FOR_KEY, version);
	} catch {
		return;
	}
	window.location.reload();
}
