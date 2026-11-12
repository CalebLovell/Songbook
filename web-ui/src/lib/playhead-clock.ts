const RESYNC_SECONDS = 0.25;
const DRIFT_PULL = 0.1;

export type PlayheadClock = {
	media: number;
	wall: number;
	lastRaw: number;
	shown: number;
};

export function startPlayheadClock(raw: number, now: number): PlayheadClock {
	return { media: raw, wall: now, lastRaw: raw, shown: raw };
}

export function tickPlayheadClock(
	clock: PlayheadClock,
	raw: number,
	now: number,
	rate: number,
): PlayheadClock {
	if (raw < clock.lastRaw) return startPlayheadClock(raw, now);
	let { media, wall } = clock;
	let at = media + ((now - wall) / 1000) * rate;
	if (Math.abs(raw - at) > RESYNC_SECONDS) {
		media = raw;
		wall = now;
		at = raw;
	} else if (raw !== clock.lastRaw) {
		media += (raw - at) * DRIFT_PULL;
	}
	return { media, wall, lastRaw: raw, shown: Math.max(clock.shown, at) };
}
