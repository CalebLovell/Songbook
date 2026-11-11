import "@tanstack/react-start/server-only";

import { type PowerAction, powerStation } from "./settings-system.server.ts";

const MESSAGES: Record<PowerAction, string> = {
	reboot:
		"The Pi is restarting. Songbook comes back by itself in a minute or two.",
	poweroff:
		"The Pi is shutting down. Wait for its green light to stop blinking before unplugging it.",
};

export async function powerStationFromRequest(
	action: PowerAction,
): Promise<{ message: string }> {
	try {
		const result = await powerStation(action);
		if (result.skipped)
			return { message: "Restarting and shutting down are off here." };
		return { message: MESSAGES[action] };
	} catch {
		throw new Error("The Pi didn't respond. Try again.");
	}
}
