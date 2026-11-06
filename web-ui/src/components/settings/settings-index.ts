import type { LucideIcon } from "lucide-react";
import {
	Disc3,
	HardDrive,
	MapPin,
	Mic2,
	RefreshCw,
	SearchCheck,
	ShieldCheck,
	SlidersHorizontal,
	Sparkles,
} from "lucide-react";

import type { SearchSetting } from "~/lib/site-search.ts";

export const SETTINGS_TABS = [
	"station",
	"detection",
	"privacy",
	"audio-input",
	"recording",
	"storage",
	"review",
	"highlights",
	"updates",
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

export const SETTINGS_INDEX: SettingsIndexEntry[] = [
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
			"Location model version",
			"Species-frequency threshold",
		],
	},
	{
		title: "Privacy",
		tab: "privacy",
		icon: ShieldCheck,
		fields: ["Privacy threshold"],
		keywords: ["human", "voice"],
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
	{
		title: "Review",
		tab: "review",
		icon: SearchCheck,
		fields: ["Rare species threshold"],
		keywords: ["queue", "confirm", "rare"],
	},
	{
		title: "Highlights",
		tab: "highlights",
		icon: Sparkles,
		fields: ["Rare", "Returned", "Gone quiet", "Regular", "Vocal"],
		keywords: ["rarity", "rarities", "returns", "thresholds"],
	},
	{
		title: "Updates",
		tab: "updates",
		icon: RefreshCw,
		fields: ["This station", "Newest release", "Automatic updates"],
		keywords: ["version", "release", "upgrade"],
	},
];
