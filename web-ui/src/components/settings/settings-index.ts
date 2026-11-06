import type { LucideIcon } from "lucide-react";
import {
	Disc3,
	HardDrive,
	Heart,
	Image,
	MapPin,
	Mic2,
	RefreshCw,
	SearchCheck,
	SlidersHorizontal,
	Sparkles,
} from "lucide-react";

import type { SearchSetting } from "~/lib/site-search.ts";

export const SETTINGS_TABS = [
	"station",
	"detection",
	"preferences",
	"updates",
	"audio-input",
	"recording",
	"storage",
] as const;

export type SettingsTab = (typeof SETTINGS_TABS)[number];

export const DEFAULT_SETTINGS_TAB: SettingsTab = "station";

export type SettingsIndexEntry = SearchSetting & {
	tab: SettingsTab;
	icon: LucideIcon;
};

export function settingsCardId(title: string): string {
	return title.toLowerCase().replaceAll(" ", "-");
}

const CORE_CARDS: SettingsIndexEntry[] = [
	{
		title: "Station",
		tab: "station",
		icon: MapPin,
		fields: ["Station name", "Latitude", "Longitude", "Timezone"],
		keywords: ["location", "coordinates"],
	},
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

const SYSTEM_CARDS: SettingsIndexEntry[] = [
	{
		title: "Updates",
		tab: "updates",
		icon: RefreshCw,
		fields: ["This station", "Newest release", "Automatic updates"],
		keywords: ["version", "release", "upgrade"],
	},
	{
		title: "Audio input",
		tab: "audio-input",
		icon: Mic2,
		fields: [
			"Input",
			"Recording device",
			"Channels",
			"RTSP streams",
			"Live-player stream",
		],
		keywords: ["microphone", "stream"],
	},
	{
		title: "Recording",
		tab: "recording",
		icon: Disc3,
		fields: ["Recording length", "Extraction length", "Audio format"],
		keywords: ["clip"],
	},
	{
		title: "Storage",
		tab: "storage",
		icon: HardDrive,
		fields: [
			"When the disk fills",
			"Disk-used threshold",
			"Maximum files per species",
		],
		keywords: ["disk", "purge"],
	},
];

export const SETTINGS_INDEX: SettingsIndexEntry[] = [
	...CORE_CARDS,
	...PREFERENCE_CARDS,
	...SYSTEM_CARDS,
];

export const SETTINGS_SECTIONS: Pick<
	SettingsIndexEntry,
	"title" | "tab" | "icon"
>[] = [
	...CORE_CARDS,
	{ title: "Preferences", tab: "preferences", icon: Heart },
	...SYSTEM_CARDS,
];
