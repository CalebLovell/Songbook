export const VISIT_GAP_MINUTES = 15;

export type DetectionMoment = {
	comName: string;
	timestamp: string;
};

export function timestampToMillis(timestamp: string): number {
	return new Date(timestamp.replace(" ", "T")).getTime();
}

export function localTimestamp(date: Date): string {
	const pad = (value: number) => String(value).padStart(2, "0");
	return (
		`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
		` ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
	);
}

export function countVisits(
	timestamps: string[],
	gapMinutes: number = VISIT_GAP_MINUTES,
): number {
	const times = timestamps
		.map(timestampToMillis)
		.filter((time) => Number.isFinite(time))
		.sort((a, b) => a - b);
	if (times.length === 0) return 0;

	const gapMs = gapMinutes * 60_000;
	let visits = 1;
	for (let index = 1; index < times.length; index += 1) {
		if (times[index] - times[index - 1] > gapMs) visits += 1;
	}
	return visits;
}

export function countVisitsBySpecies(
	moments: DetectionMoment[],
	gapMinutes: number = VISIT_GAP_MINUTES,
): number {
	const timestampsByName = new Map<string, string[]>();
	for (const moment of moments) {
		const existing = timestampsByName.get(moment.comName);
		if (existing) existing.push(moment.timestamp);
		else timestampsByName.set(moment.comName, [moment.timestamp]);
	}

	let total = 0;
	for (const timestamps of timestampsByName.values()) {
		total += countVisits(timestamps, gapMinutes);
	}
	return total;
}

export type Visit<Moment extends DetectionMoment> = {
	comName: string;
	moments: Moment[];
};

export function groupVisits<Moment extends DetectionMoment>(
	moments: Moment[],
	gapMinutes: number = VISIT_GAP_MINUTES,
): Visit<Moment>[] {
	const gapMs = gapMinutes * 60_000;
	const sorted = moments
		.map((moment) => ({ moment, time: timestampToMillis(moment.timestamp) }))
		.filter(({ time }) => Number.isFinite(time))
		.sort((a, b) => a.time - b.time);

	const visits: { visit: Visit<Moment>; lastTime: number }[] = [];
	const openBySpecies = new Map<string, (typeof visits)[number]>();
	for (const { moment, time } of sorted) {
		const open = openBySpecies.get(moment.comName);
		if (open && time - open.lastTime <= gapMs) {
			open.visit.moments.push(moment);
			open.lastTime = time;
			continue;
		}
		const started = {
			visit: { comName: moment.comName, moments: [moment] },
			lastTime: time,
		};
		visits.push(started);
		openBySpecies.set(moment.comName, started);
	}

	return visits
		.sort((a, b) => b.lastTime - a.lastTime)
		.map(({ visit }) => visit);
}
