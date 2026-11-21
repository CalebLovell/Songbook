import { QueryClientProvider } from "@tanstack/react-query";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { getGlobalStartContext } from "@tanstack/react-start";
import {
	rememberTabSpots,
	tabScrollKey,
} from "./components/sidebar/tab-spots.ts";
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
		getScrollRestorationKey: tabScrollKey,
		scrollToTopSelectors: ["#app-scroll", "[data-scroll-reset]"],
		defaultPreload: "intent",
		defaultPendingMs: 0,
		defaultPendingMinMs: 0,
		ssr: { nonce: getGlobalStartContext()?.cspNonce },
	});
	registerUnlockStatusRouter(router);
	if (!router.isServer) rememberTabSpots(router);

	return router;
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
