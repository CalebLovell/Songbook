const RAMP_FLOOR = 12;

const INK_FLIP = 55;

export function heatShare(count: number, maximum: number): number {
	if (count <= 0 || maximum <= 0) return 0;
	if (maximum <= 1) return 1;
	return Math.min(1, Math.log(count) / Math.log(maximum));
}

export function heatColorAt(share: number): string {
	if (share >= 1) return "var(--moss)";
	const moss = RAMP_FLOOR + (100 - RAMP_FLOOR) * Math.max(0, share);
	return `color-mix(in oklab, var(--moss) ${moss.toFixed(1)}%, var(--paper-raised))`;
}

export function heatColor(count: number, maximum: number): string {
	if (count <= 0 || maximum <= 0) return "var(--paper)";
	return heatColorAt(heatShare(count, maximum));
}

export function heatInk(count: number, maximum: number): string {
	if (count <= 0) return "var(--muted-foreground)";
	const moss = RAMP_FLOOR + (100 - RAMP_FLOOR) * heatShare(count, maximum);
	return moss >= INK_FLIP ? "var(--paper)" : "var(--foreground)";
}

export function heatMaximum(rows: { hourCounts: number[] }[]): number {
	return rows.reduce((top, row) => Math.max(top, ...row.hourCounts), 0);
}
