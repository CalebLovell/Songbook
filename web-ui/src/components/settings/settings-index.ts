import type { LucideIcon } from "lucide-react";
import {
	Database,
	FileDown,
	Heart,
	Image,
	RotateCcw,
	SearchCheck,
	SlidersHorizontal,
	Sparkles,
	Volume2,
} from "lucide-react";

import type { SearchSetting } from "~/lib/site-search.ts";

export const SETTINGS_TABS = ["detection", "preferences", "data"] as const;

export type SettingsTab = (typeof SETTINGS_TABS)[number];

export const DEFAULT_SETTINGS_TAB: SettingsTab = "detection";

export type SettingsIndexEntry = SearchSetting & {
	tab: SettingsTab;
	icon: LucideIcon;
};

export function settingsCardId(title: string): string {
	return title.toLowerCase().replaceAll(" ", "-");
}

const CORE_CARDS: SettingsIndexEntry[] = [
	{
		title: "Detection",
		tab: "detection",
		icon: SlidersHorizontal,
		fields: [
			"Minimum confidence",
			"Sensitivity",
			"Analysis overlap",
			"Species-frequency threshold",
			"Privacy threshold",
		],
		keywords: ["privacy", "human", "voice"],
	},
];

const PREFERENCE_CARDS: SettingsIndexEntry[] = [
	{
		title: "Artwork",
		tab: "preferences",
		icon: Image,
		fields: ["Show birds as"],
		keywords: [
			"preferences",
			"illustrations",
			"paintings",
			"photos",
			"pictures",
		],
	},
	{
		title: "Playback",
		tab: "preferences",
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
	},
	{
		title: "Highlights",
		tab: "preferences",
		icon: Sparkles,
		fields: ["Rare", "Returned", "Gone quiet", "Regular", "Vocal"],
		keywords: ["preferences", "rarity", "rarities", "returns", "thresholds"],
	},
	{
		title: "Review",
		tab: "preferences",
		icon: SearchCheck,
		fields: ["Rare species threshold"],
		keywords: ["preferences", "queue", "confirm", "rare"],
	},
];

const DATA_CARDS: SettingsIndexEntry[] = [
	{
		title: "Restore",
		tab: "data",
		icon: RotateCcw,
		fields: ["Backup file", "Safety copy"],
		keywords: ["data", "import", "upload", "move", "new station", "undo"],
	},
	{
		title: "Export detections",
		tab: "data",
		icon: FileDown,
		fields: ["From", "To", "Species"],
		keywords: ["data", "csv", "spreadsheet", "download"],
	},
];

export const SETTINGS_INDEX: SettingsIndexEntry[] = [
	...CORE_CARDS,
	...PREFERENCE_CARDS,
	...DATA_CARDS,
];

export const SETTINGS_SECTIONS: Pick<
	SettingsIndexEntry,
	"title" | "tab" | "icon"
>[] = [
	...CORE_CARDS,
	{ title: "Preferences", tab: "preferences", icon: Heart },
	{ title: "Data", tab: "data", icon: Database },
];
