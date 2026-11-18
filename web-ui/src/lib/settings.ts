import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUnlocked } from "./auth.ts";
import {
	loadSettingsPageData,
	resetSettings,
	restartStation,
	saveArtworkSettings,
	saveDetectionSettings,
	saveHighlightSettings,
	savePlaybackSettings,
	saveReviewSettings,
	saveStationSettings,
	saveUpdateSettings,
} from "./settings.server.ts";
import {
	artworkSettingsSchema,
	detectionSettingsSchema,
	highlightSettingsSchema,
	playbackSettingsSchema,
	reviewSettingsSchema,
	stationSettingsSchema,
	updateSettingsSchema,
} from "./settings-data.ts";

export const getSettingsPage = createServerFn({ method: "GET" })
	.middleware([requireUnlocked])
	.handler(() => loadSettingsPageData());

export const saveStationSettingsFn = createServerFn({ method: "POST" })
	.middleware([requireUnlocked])
	.validator(stationSettingsSchema)
	.handler(({ data }) => saveStationSettings(data));

export const saveDetectionSettingsFn = createServerFn({ method: "POST" })
	.middleware([requireUnlocked])
	.validator(detectionSettingsSchema)
	.handler(({ data }) => saveDetectionSettings(data));

export const saveReviewSettingsFn = createServerFn({ method: "POST" })
	.middleware([requireUnlocked])
	.validator(reviewSettingsSchema)
	.handler(({ data }) => saveReviewSettings(data));

export const saveHighlightSettingsFn = createServerFn({ method: "POST" })
	.middleware([requireUnlocked])
	.validator(highlightSettingsSchema)
	.handler(({ data }) => saveHighlightSettings(data));

export const saveArtworkSettingsFn = createServerFn({ method: "POST" })
	.middleware([requireUnlocked])
	.validator(artworkSettingsSchema)
	.handler(({ data }) => saveArtworkSettings(data));

export const savePlaybackSettingsFn = createServerFn({ method: "POST" })
	.middleware([requireUnlocked])
	.validator(playbackSettingsSchema)
	.handler(({ data }) => savePlaybackSettings(data));

export const saveUpdateSettingsFn = createServerFn({ method: "POST" })
	.middleware([requireUnlocked])
	.validator(updateSettingsSchema)
	.handler(({ data }) => saveUpdateSettings(data));

export const resetSettingsFn = createServerFn({ method: "POST" })
	.middleware([requireUnlocked])
	.handler(() => resetSettings());

export const restartStationFn = createServerFn({ method: "POST" })
	.middleware([requireUnlocked])
	.validator(
		z.object({
			card: z
				.enum([
					"station",
					"detection",
					"review",
					"highlights",
					"artwork",
					"playback",
					"updates",
				])
				.optional(),
		}),
	)
	.handler(({ data }) => restartStation(data.card));
