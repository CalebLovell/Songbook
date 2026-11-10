import { createElement, Fragment, type ReactNode } from "react";

export const PAGE_HEADERS = {
	birds: {
		title: "All Birds",
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
		missingDescription:
			"What this station heard, at whatever scale you ask for.",
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
		description: "Test your knowledge of the bird calls from your station.",
	},
	speciesFilter: {
		title: "Species Filter",
		description: "Decide which installed species BirdNET may detect.",
	},
	settings: {
		title: "Settings",
		description: "Adjust how your station runs.",
	},
	signIn: {
		title: "Sign in",
		description: "Sign in to manage your station.",
	},
} as const;
