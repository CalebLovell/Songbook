export const EMPTY = {
	station: {
		liveHeroTitle: "All Quiet",
		liveHeroBody: "As birds are heard, each new one will appear here.",
		detections: "No detections recorded yet.",
		species: "No species recorded yet.",
		recordings: "No recordings yet.",
	},

	window: {
		liveQuietTitle: "All Quiet",
		liveQuietBody:
			"Nothing heard in the last 24 hours. New detections will appear here on their own.",
		last24Hours: "No detections recorded in the last 24 hours.",
		timelineWindow: (windowLabel: string | null) =>
			windowLabel
				? `No detections recorded for ${windowLabel}.`
				: "No detections recorded in this window.",
		birdVisits: "No visits recorded yet.",
		birdRecording: "No recording to play yet.",
	},

	filter: {
		birdsSearch: (search: string) => `No birds match “${search}”.`,
		detectionsFilters: "No detections match these filters.",
		speciesControlSearch: "No species match that search.",
		recategorizeSearch: (search: string) => `No species match “${search}”.`,
		learnPool: "Not enough species with recordings in this selection.",
	},

	done: {
		reviewPage: "No recordings left on this page.",
		reviewQueue: "No recordings to review.",
	},
} as const;
