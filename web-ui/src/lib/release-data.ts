export const RELOAD_WHEN_IDLE_MS = 5 * 60_000;

export function newerRelease(
	running: string | null,
	station: string | null,
): string | null {
	if (!running || !station || running === station) return null;
	return station;
}

export type PageActivity = {
	hidden: boolean;
	idleMs: number;
	playing: boolean;
	editing: boolean;
};

export function safeToReload(page: PageActivity): boolean {
	if (page.playing || page.editing) return false;
	return page.hidden || page.idleMs >= RELOAD_WHEN_IDLE_MS;
}
