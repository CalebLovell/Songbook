import { linkOptions } from "@tanstack/react-router";
import {
	AudioWaveform,
	CalendarRange,
	Feather,
	Lightbulb,
	Sun,
} from "lucide-react";

export const EXPLORE_LINKS = [
	{ label: "Today", icon: Sun, link: linkOptions({ to: "/today" }) },
	{
		label: "Timeline",
		icon: CalendarRange,
		link: linkOptions({
			to: "/timeline",
			activeOptions: { includeSearch: false },
		}),
	},
	{ label: "All Birds", icon: Feather, link: linkOptions({ to: "/birds" }) },
	{
		label: "Detections",
		icon: AudioWaveform,
		link: linkOptions({
			to: "/detections",
			search: { page: 1, sort: "recorded", direction: "desc" },
			activeOptions: { includeSearch: false },
		}),
	},
	{ label: "Learn", icon: Lightbulb, link: linkOptions({ to: "/learn" }) },
] as const;
