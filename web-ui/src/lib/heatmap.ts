const RAMP_FLOOR = 12;

// Between these mixes neither digit colour reaches 4.5:1, so the ramp steps over them.
const DARK_DIGIT_LAST = 59;
const PALE_DIGIT_FIRST = 66;

function rampMoss(share: number): number {
	const moss = RAMP_FLOOR + (100 - RAMP_FLOOR) * Math.max(0, share);
	return moss > DARK_DIGIT_LAST && moss < PALE_DIGIT_FIRST
		? PALE_DIGIT_FIRST
		: moss;
}

export function heatShare(count: number, maximum: number): number {
	if (count <= 0 || maximum <= 0) return 0;
	if (maximum <= 1) return 1;
	return Math.min(1, Math.log(count) / Math.log(maximum));
}

export function heatColorAt(share: number): string {
	if (share >= 1) return "var(--moss)";
	return `color-mix(in oklab, var(--moss) ${rampMoss(share).toFixed(1)}%, var(--paper-raised))`;
}

export function heatColor(count: number, maximum: number): string {
	if (count <= 0 || maximum <= 0) return "var(--paper)";
	return heatColorAt(heatShare(count, maximum));
}

export function heatInk(count: number, maximum: number): string {
	if (count <= 0) return "var(--muted-foreground)";
	return rampMoss(heatShare(count, maximum)) >= PALE_DIGIT_FIRST
		? "var(--paper)"
		: "var(--foreground)";
}

export function heatMaximum(rows: { hourCounts: number[] }[]): number {
	return rows.reduce((top, row) => Math.max(top, ...row.hourCounts), 0);
}
