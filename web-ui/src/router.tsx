import {
	createRouter as createTanStackRouter,
	parseSearchWith,
	stringifySearchWith,
} from "@tanstack/react-router";
import { registerUnlockStatusRouter } from "./lib/unlock-status.ts";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
	const router = createTanStackRouter({
		routeTree,
		// No parser argument: with one, a numeric-looking string is quoted in the URL
		// (?date=%222026%22). Search schemas coerce such values back to strings.
		stringifySearch: stringifySearchWith(JSON.stringify),
		parseSearch: parseSearchWith(JSON.parse),
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
