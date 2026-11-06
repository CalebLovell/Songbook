import {
	type FetchQueryOptions,
	QueryClient,
	type QueryKey,
} from "@tanstack/react-query";

export function createQueryClient() {
	return new QueryClient({
		defaultOptions: {
			// "always": a station on the LAN stays reachable when the browser reports offline.
			queries: { retry: false, networkMode: "always" },
			mutations: { networkMode: "always" },
		},
	});
}

// Browser only: useQuery doesn't fetch during SSR, so the first paint is the
// same shell on server and client and hydration can't race the data.
export function prefetchInBrowser<T, Key extends QueryKey>(
	queryClient: QueryClient,
	options: FetchQueryOptions<T, Error, T, Key>,
) {
	if (typeof window !== "undefined") void queryClient.prefetchQuery(options);
}
