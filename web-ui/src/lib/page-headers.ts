import { createElement, Fragment, type ReactNode } from "react";

export const PAGE_HEADERS = {
	today: {
		title: "Today",
		description: "What the station is hearing right now.",
	},
	birds: {
		title: "All Birds",
		sectionDescription: "Every species this station has recorded.",
		description: (
			detections: ReactNode,
			species: ReactNode,
			oneDetection: boolean,
		) =>
			createElement(
				Fragment,
				null,
				"This station has recorded ",
				detections,
				` total ${oneDetection ? "detection" : "detections"} from `,
				species,
				" species.",
			),
	},
	timeline: {
		description: "Every detection, by species, over the selected time period.",
		missingSection: "Timeline",
		missingDescription: "What this station heard, by day, week, month or year.",
	},
	detections: {
		title: "Detections",
		description: "Browse, filter, and manage every individual detection.",
	},
	review: {
		title: "Review detections",
		description: "Confirm or correct uncertain detections.",
	},
	learn: {
		title: "Learn the calls",
		description: "A listening quiz built from this station's own recordings.",
	},
	speciesFilter: {
		title: "Species Filter",
		description: "Decide which installed species BirdNET may detect.",
	},
	station: {
		title: "Station",
		description: "How the station is doing, how it listens, and what it needs.",
	},
	settings: {
		title: "Settings",
		description: "How birds look, sound and get called out across the site.",
	},
	signIn: {
		title: "Sign in",
		description: "Sign in to manage your station.",
	},
} as const;
