export type MeasureText = (text: string, size: number) => number;

const ELLIPSIS = "…";

export function fitSize(
	measure: MeasureText,
	texts: string[],
	maxWidth: number,
	largest: number,
	smallest: number,
): number {
	for (let size = largest; size > smallest; size -= 2) {
		if (texts.every((text) => measure(text, size) <= maxWidth)) return size;
	}
	return smallest;
}

export function truncate(
	measure: MeasureText,
	text: string,
	size: number,
	maxWidth: number,
): string {
	if (measure(text, size) <= maxWidth) return text;
	let end = text.length;
	while (
		end > 0 &&
		measure(`${text.slice(0, end).trimEnd()}${ELLIPSIS}`, size) > maxWidth
	) {
		end--;
	}
	return `${text.slice(0, end).trimEnd()}${ELLIPSIS}`;
}

export function wrapLines(
	measure: MeasureText,
	text: string,
	size: number,
	maxWidth: number,
	maxLines: number,
): string[] {
	const lines: string[] = [];
	for (const word of text.split(/\s+/).filter(Boolean)) {
		const last = lines.at(-1);
		if (last !== undefined && measure(`${last} ${word}`, size) <= maxWidth) {
			lines[lines.length - 1] = `${last} ${word}`;
		} else {
			lines.push(word);
		}
	}
	const kept = lines.slice(0, maxLines);
	if (lines.length > maxLines) {
		kept[maxLines - 1] = lines.slice(maxLines - 1).join(" ");
	}
	return kept.map((line) => truncate(measure, line, size, maxWidth));
}
