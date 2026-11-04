declare global {
	interface Window {
		__songbookStationTimeZone?: string;
	}
}

function runtimeTimeZone(): string {
	return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function stationTimeZone(): string {
	if (typeof window !== "undefined") {
		return window.__songbookStationTimeZone ?? runtimeTimeZone();
	}
	return runtimeTimeZone();
}

export function stationTimeZoneScript(): string {
	const zone = JSON.stringify(stationTimeZone()).replace(/</g, "\\u003c");
	return `window.__songbookStationTimeZone=${zone}`;
}

const DAY_FORMATS = new Map<string, Intl.DateTimeFormat>();

function dayFormat(zone: string): Intl.DateTimeFormat {
	let format = DAY_FORMATS.get(zone);
	if (!format) {
		format = new Intl.DateTimeFormat("en-US", {
			timeZone: zone,
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
		});
		DAY_FORMATS.set(zone, format);
	}
	return format;
}

export function stationToday(
	now: Date = new Date(),
	zone: string = stationTimeZone(),
): string {
	let parts: Intl.DateTimeFormatPart[];
	try {
		parts = dayFormat(zone).formatToParts(now);
	} catch {
		parts = dayFormat(runtimeTimeZone()).formatToParts(now);
	}
	const part = (type: string) => parts.find((p) => p.type === type)?.value;
	return `${part("year")}-${part("month")}-${part("day")}`;
}
