import { type SyntheticEvent, useEffect, useRef } from "react";

type LastClick = { clickedId: string; rows: string[] };

export function rowsInShiftClick(
	orderedIds: string[],
	last: LastClick | null,
	clickedId: string,
	shiftKey: boolean,
): string[] {
	if (!shiftKey || last === null) return [clickedId];
	if (last.clickedId === clickedId) {
		return last.rows.filter((id) => orderedIds.includes(id));
	}
	const anchor = orderedIds.indexOf(last.clickedId);
	const clicked = orderedIds.indexOf(clickedId);
	if (anchor < 0 || clicked < 0) return [clickedId];
	return orderedIds.slice(
		Math.min(anchor, clicked),
		Math.max(anchor, clicked) + 1,
	);
}

export function useShiftClickRange(hasSelection: boolean) {
	const last = useRef<LastClick | null>(null);
	const changedByClick = useRef(false);

	useEffect(() => {
		if (!hasSelection && !changedByClick.current) last.current = null;
	}, [hasSelection]);

	useEffect(() => {
		changedByClick.current = false;
	});

	return function rowsForClick(
		orderedIds: string[],
		clickedId: string,
		event: SyntheticEvent,
	): string[] {
		const { shiftKey } = event.nativeEvent as MouseEvent;
		const rows = rowsInShiftClick(
			orderedIds,
			last.current,
			clickedId,
			shiftKey,
		);
		last.current = { clickedId, rows };
		changedByClick.current = true;
		return rows;
	};
}
