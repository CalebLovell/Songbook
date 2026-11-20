import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUnlocked } from "./auth.ts";
import {
	loadSettingsPageData,
	resetPreferences,
	restartStation,
	saveDetectionSettings,
	savePreferences,
	saveStationSettings,
	saveUpdateSettings,
} from "./settings.server.ts";
import {
	detectionSettingsSchema,
	preferencesSchema,
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

export const savePreferencesFn = createServerFn({ method: "POST" })
	.middleware([requireUnlocked])
	.validator(preferencesSchema)
	.handler(({ data }) => savePreferences(data));

export const resetPreferencesFn = createServerFn({ method: "POST" })
	.middleware([requireUnlocked])
	.handler(() => resetPreferences());

export const saveUpdateSettingsFn = createServerFn({ method: "POST" })
	.middleware([requireUnlocked])
	.validator(updateSettingsSchema)
	.handler(({ data }) => saveUpdateSettings(data));

export const restartStationFn = createServerFn({ method: "POST" })
	.middleware([requireUnlocked])
	.validator(
		z.object({
			card: z
				.enum([
					"station",
					"detection",
					"highlights",
					"artwork",
					"playback",
					"updates",
				])
				.optional(),
		}),
	)
	.handler(({ data }) => restartStation(data.card));
