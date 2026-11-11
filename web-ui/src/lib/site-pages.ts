import {
	Activity,
	AudioWaveform,
	CalendarRange,
	Feather,
	HeartPulse,
	Lightbulb,
	type LucideIcon,
	SearchCheck,
	Settings,
	SlidersHorizontal,
} from "lucide-react";

import { PAGE_HEADERS } from "~/lib/page-headers.ts";

export type SitePage = {
	label: string;
	to: string;
	icon: LucideIcon;
	gated?: boolean;
	header: { title: string; description: string };
};

export const SITE_PAGES: readonly SitePage[] = [
	{
		label: "Live Feed",
		to: "/live",
		icon: Activity,
		header: PAGE_HEADERS.live,
	},
	{
		label: "Timeline",
		to: "/timeline",
		icon: CalendarRange,
		header: {
			title: PAGE_HEADERS.timeline.missingSection,
			description: PAGE_HEADERS.timeline.missingDescription,
		},
	},
	{
		label: "All Birds",
		to: "/birds",
		icon: Feather,
		header: {
			title: PAGE_HEADERS.birds.title,
			description: PAGE_HEADERS.birds.sectionDescription,
		},
	},
	{
		label: "Detections",
		to: "/detections",
		icon: AudioWaveform,
		header: PAGE_HEADERS.detections,
	},
	{ label: "Learn", to: "/learn", icon: Lightbulb, header: PAGE_HEADERS.learn },
	{
		label: "Health",
		to: "/health",
		icon: HeartPulse,
		gated: true,
		header: PAGE_HEADERS.health,
	},
	{
		label: "Review",
		to: "/review",
		icon: SearchCheck,
		gated: true,
		header: PAGE_HEADERS.review,
	},
	{
		label: "Species Filter",
		to: "/species-filter",
		icon: SlidersHorizontal,
		gated: true,
		header: PAGE_HEADERS.speciesFilter,
	},
	{
		label: "Settings",
		to: "/settings",
		icon: Settings,
		gated: true,
		header: PAGE_HEADERS.settings,
	},
];

const MAX_TYPO_DISTANCE = 2;

function firstSegment(pathname: string): string {
	return pathname.split("/").find(Boolean)?.toLowerCase() ?? "";
}

function slugOf(page: SitePage): string {
	return page.to.slice(1);
}

function editDistance(a: string, b: string): number {
	let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
	for (let i = 1; i <= a.length; i++) {
		const current = [i];
		for (let j = 1; j <= b.length; j++) {
			const substitution = previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
			current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, substitution);
		}
		previous = current;
	}
	return previous[b.length];
}

export function sitePageFor(pathname: string): SitePage | undefined {
	const segment = firstSegment(pathname) || "live";
	return SITE_PAGES.find((page) => slugOf(page) === segment);
}

export function closestSitePage(pathname: string): SitePage | undefined {
	const segment = firstSegment(pathname);
	if (!segment) return undefined;

	let best: { page: SitePage; distance: number } | undefined;
	for (const page of SITE_PAGES) {
		const slug = slugOf(page);
		const distance = editDistance(segment, slug);
		const limit = Math.min(MAX_TYPO_DISTANCE, Math.floor(slug.length / 3));
		if (distance > limit) continue;
		if (!best || distance < best.distance) best = { page, distance };
	}
	return best?.page;
}
