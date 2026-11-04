const DATE = new Intl.DateTimeFormat("en-US", {
	month: "short",
	day: "numeric",
	year: "numeric",
});

const DATE_TIME = new Intl.DateTimeFormat("en-US", {
	month: "short",
	day: "numeric",
	year: "numeric",
	hour: "numeric",
	minute: "2-digit",
});

function parse(date: string, time = "00:00:00"): Date | null {
	const parsed = new Date(`${date}T${time}`);
	return Number.isNaN(parsed.valueOf()) ? null : parsed;
}

export function formatDate(date: string): string {
	const parsed = parse(date.slice(0, 10));
	return parsed ? DATE.format(parsed) : date;
}

export function formatDateTime(dateOrTimestamp: string, time?: string): string {
	const date = dateOrTimestamp.slice(0, 10);
	const clock = time ?? dateOrTimestamp.slice(11);
	const parsed = parse(date, clock || undefined);
	return parsed
		? DATE_TIME.format(parsed)
		: [dateOrTimestamp, time].filter(Boolean).join(" ");
}

const TIME = new Intl.DateTimeFormat("en-US", {
	hour: "numeric",
	minute: "2-digit",
});

export function formatTime(time: string): string {
	const parsed = parse("2000-01-01", time);
	return parsed ? TIME.format(parsed) : time;
}
