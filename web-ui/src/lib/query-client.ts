import {
	type FetchQueryOptions,
	QueryClient,
	type QueryKey,
} from "@tanstack/react-query";
import type { AnyRouter } from "@tanstack/react-router";

import { isUnauthorizedError } from "~/lib/auth.ts";

export function createQueryClient() {
	return new QueryClient({
		defaultOptions: {
			// "always": a station on the LAN stays reachable when the browser reports offline.
			queries: { retry: false, networkMode: "always" },
			mutations: { networkMode: "always" },
		},
	});
}

// Page data refreshes on navigation, after a change, and on pull to refresh. A
// refetch on focus would move rows under a reviewer or deal a new Learn round.
export const PAGE_QUERY = {
	staleTime: 10_000,
	refetchOnWindowFocus: false,
	refetchOnReconnect: false,
	throwOnError: (error: Error, query: { state: { data: unknown } }) =>
		query.state.data === undefined || isUnauthorizedError(error),
};

// For pages whose forms seed from the data once: a cached copy would seed them
// with an old revision.
export const FORM_QUERY = { ...PAGE_QUERY, staleTime: 0, gcTime: 0 };

export function refreshAllData(router: AnyRouter, queryClient: QueryClient) {
	return Promise.all([router.invalidate(), queryClient.invalidateQueries()]);
}

// Browser only: useQuery doesn't fetch during SSR, so the first paint is the
// same shell on server and client and hydration can't race the data.
export function prefetchInBrowser<T, Key extends QueryKey>(
	queryClient: QueryClient,
	options: FetchQueryOptions<T, Error, T, Key>,
) {
	if (typeof window !== "undefined") void queryClient.prefetchQuery(options);
}
