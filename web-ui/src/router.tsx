import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { parseSearch, stringifySearch } from "./lib/search-params.ts";
import { registerUnlockStatusRouter } from "./lib/unlock-status.ts";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
	const router = createTanStackRouter({
		routeTree,
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
