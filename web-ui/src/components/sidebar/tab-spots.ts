import {
	type AnyRouter,
	type ParsedLocation,
	useRouterState,
} from "@tanstack/react-router";
import { useSyncExternalStore } from "react";

import { EXPLORE_LINKS } from "~/components/sidebar/explore-links.ts";

type ExploreLink = (typeof EXPLORE_LINKS)[number]["link"];
type Spot = { pathname: string; search: Record<string, unknown> };

const spots = new Map<string, Spot>();
const listeners = new Set<() => void>();

export function exploreTabFor(pathname: string): string | undefined {
	return EXPLORE_LINKS.find(
		({ link }) => pathname === link.to || pathname.startsWith(`${link.to}/`),
	)?.link.to;
}

export function rememberTabSpots(router: AnyRouter) {
	router.subscribe("onResolved", ({ toLocation }) => {
		const tab = exploreTabFor(toLocation.pathname);
		if (!tab) return;
		spots.set(tab, {
			pathname: toLocation.pathname,
			search: toLocation.search,
		});
		for (const listener of listeners) listener();
	});
}

export function tabScrollKey(location: ParsedLocation) {
	return exploreTabFor(location.pathname)
		? location.href
		: location.state.__TSR_key || location.href;
}

function subscribe(listener: () => void) {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

export function useTabLink(link: ExploreLink): ExploreLink {
	const spot = useSyncExternalStore(
		subscribe,
		() => spots.get(link.to),
		() => undefined,
	);
	const isCurrentTab = useRouterState({
		select: (state) => exploreTabFor(state.location.pathname) === link.to,
	});
	if (!spot || isCurrentTab) return link;
	return {
		...link,
		to: spot.pathname as ExploreLink["to"],
		search: spot.search,
	} as ExploreLink;
}
