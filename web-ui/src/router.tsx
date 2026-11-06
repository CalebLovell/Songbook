import { QueryClientProvider } from "@tanstack/react-query";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { createQueryClient } from "./lib/query-client.ts";
import { parseSearch, stringifySearch } from "./lib/search-params.ts";
import { registerUnlockStatusRouter } from "./lib/unlock-status.ts";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
	const queryClient = createQueryClient();
	const router = createTanStackRouter({
		routeTree,
		context: { queryClient },
		Wrap: ({ children }) => (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		),
		stringifySearch,
		parseSearch,
		scrollRestoration: true,
		scrollToTopSelectors: ["#app-scroll", "[data-scroll-reset]"],
		defaultPreload: "intent",
		defaultPreloadStaleTime: 0,
		defaultPendingMs: 0,
		defaultPendingMinMs: 0,
	});
	registerUnlockStatusRouter(router);

	return router;
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
