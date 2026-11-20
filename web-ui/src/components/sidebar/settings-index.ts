import type { LucideIcon } from "lucide-react";
import {
	FileDown,
	Image,
	SlidersHorizontal,
	Sparkles,
	Upload,
	Volume2,
} from "lucide-react";

import type { SearchSetting } from "~/lib/site-search.ts";

export type SettingsIndexEntry = SearchSetting & {
	to: "/settings" | "/station" | "/detections";
	hash?: string;
	icon: LucideIcon;
};

function preference(
	entry: Omit<SettingsIndexEntry, "to" | "hash">,
): SettingsIndexEntry {
	return { ...entry, to: "/settings" };
}

export const SETTINGS_INDEX: SettingsIndexEntry[] = [
	{
		title: "Detection",
		to: "/station",
		hash: "model",
		icon: SlidersHorizontal,
		fields: [
			"Minimum confidence",
			"Sensitivity",
			"Analysis overlap",
			"Privacy threshold",
		],
		keywords: ["privacy", "human", "voice", "tune", "birdnet"],
	},
	preference({
		title: "Artwork",
		icon: Image,
		fields: ["Show birds as"],
		keywords: [
			"preferences",
			"illustrations",
			"paintings",
			"photos",
			"pictures",
		],
	}),
	preference({
		title: "Playback",
		icon: Volume2,
		fields: ["Boost quiet recordings"],
		keywords: [
			"preferences",
			"volume",
			"loud",
			"louder",
			"gain",
			"compression",
			"audio",
		],
	}),
	preference({
		title: "Highlights",
		icon: Sparkles,
		fields: ["Rare", "Returned", "Gone quiet", "Regular", "Vocal"],
		keywords: [
			"preferences",
			"rarity",
			"rarities",
			"returns",
			"thresholds",
			"review",
			"queue",
		],
	}),
	{
		title: "Restore a backup",
		to: "/station",
		hash: "backups",
		icon: Upload,
		fields: ["Backup file", "Safety copy"],
		keywords: ["data", "import", "upload", "move", "new station", "undo"],
	},
	{
		title: "Download CSV",
		to: "/detections",
		icon: FileDown,
		fields: [],
		keywords: ["export", "data", "csv", "spreadsheet", "download"],
	},
];
