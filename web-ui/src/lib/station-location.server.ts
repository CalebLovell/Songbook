import "@tanstack/react-start/server-only";

import { readSettingsPageValues } from "./settings-config.server.ts";

export type StationLocation = {
	latitude: number;
	longitude: number;
	timezone: string;
};

export async function readStationLocation(): Promise<StationLocation | null> {
	try {
		const { station } = await readSettingsPageValues();
		return {
			latitude: station.latitude,
			longitude: station.longitude,
			timezone: station.timezone,
		};
	} catch {
		return null;
	}
}
