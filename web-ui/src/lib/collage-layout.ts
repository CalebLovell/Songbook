export type CollageMask = {
	width: number;
	height: number;
	filled: Uint8Array;
};

export type CollageTile = {
	key: string;
	count: number;
	mask: CollageMask;
};

export type CollagePlacement = {
	key: string;
	x: number;
	y: number;
	width: number;
	height: number;
};

export type CollageLayout = {
	placements: CollagePlacement[];
	cell: number;
	columns: number;
	owners: Int16Array;
	view: {
		zoom: number;
		fromX: number;
		fromY: number;
		toX: number;
		toY: number;
	};
};

const IDENTITY_VIEW = { zoom: 1, fromX: 0, fromY: 0, toX: 0, toY: 0 };
const MAX_ZOOM = 3;
const SHAPE_POWER = 4;

const COUNT_EXPONENT = 0.65;
const MAX_BIAS = 3;
const FILL_TARGET = 0.9;
const MIN_SCALE = 0.25;
const SCALE_SEARCH_STEPS = 5;
const GRID_CELLS_ACROSS = 280;
const MIN_TILE_SIDE = 44;

export function layoutCollage(
	tiles: readonly CollageTile[],
	width: number,
	height: number,
): CollageLayout {
	const cell = Math.max(
		3,
		Math.round(Math.max(width, height) / GRID_CELLS_ACROSS),
	);
	const columns = Math.floor(width / cell);
	const rows = Math.floor(height / cell);
	const empty: CollageLayout = {
		placements: [],
		cell,
		columns,
		owners: new Int16Array(Math.max(0, columns * rows)).fill(-1),
		view: IDENTITY_VIEW,
	};
	if (tiles.length === 0 || columns < 4 || rows < 4) return empty;

	const sized = sizeTiles(tiles, width * height);
	const candidates = spiralOrder(columns, rows);
	const packAt = (scale: number, strict: boolean) =>
		pack(sized, scale, cell, columns, rows, candidates, strict);

	let fits = MIN_SCALE;
	let tooBig = 1;
	let best = packAt(fits, true);
	if (best.placements.length < sized.length) {
		return fitted(packAt(fits, false), width, height);
	}
	const largest = packAt(tooBig, true);
	if (largest.placements.length === sized.length) {
		return fitted(largest, width, height);
	}
	for (let step = 0; step < SCALE_SEARCH_STEPS; step++) {
		const scale = (fits + tooBig) / 2;
		const packed = packAt(scale, true);
		if (packed.placements.length === sized.length) {
			fits = scale;
			best = packed;
		} else {
			tooBig = scale;
		}
	}
	return fitted(best, width, height);
}

type SizedTile = {
	tile: CollageTile;
	index: number;
	width: number;
	height: number;
};

function sizeTiles(
	tiles: readonly CollageTile[],
	viewportArea: number,
): SizedTile[] {
	const scores = tiles.map((tile) => Math.max(1, tile.count) ** COUNT_EXPONENT);
	const total = scores.reduce((sum, score) => sum + score, 0);
	const budget = FILL_TARGET * viewportArea;
	const minArea = MIN_TILE_SIDE * MIN_TILE_SIDE;
	return tiles
		.map((tile, index) => {
			const area = Math.max(minArea, (budget / total) * scores[index]);
			const aspect = tile.mask.width / tile.mask.height;
			const w = Math.sqrt(area * aspect);
			return { tile, index, width: w, height: area / w };
		})
		.sort((a, b) => b.width * b.height - a.width * a.height);
}

function spiralOrder(columns: number, rows: number): Int32Array {
	const bias = Math.min(MAX_BIAS, Math.max(1 / MAX_BIAS, columns / rows));
	const cx = columns / 2;
	const cy = rows / 2;
	const order = Array.from({ length: columns * rows }, (_, i) => i);
	const cost = (i: number) => {
		const dx = Math.abs(((i % columns) - cx) / bias);
		const dy = Math.abs(Math.floor(i / columns) - cy);
		return dx ** SHAPE_POWER + dy ** SHAPE_POWER;
	};
	const costs = order.map(cost);
	order.sort((a, b) => costs[a] - costs[b]);
	return Int32Array.from(order);
}

function rasterize(
	mask: CollageMask,
	columns: number,
	rows: number,
): Uint8Array {
	const cells = new Uint8Array(columns * rows);
	for (let cy = 0; cy < rows; cy++) {
		const my0 = Math.floor((cy / rows) * mask.height);
		const my1 = Math.max(my0 + 1, Math.ceil(((cy + 1) / rows) * mask.height));
		for (let cx = 0; cx < columns; cx++) {
			const mx0 = Math.floor((cx / columns) * mask.width);
			const mx1 = Math.max(
				mx0 + 1,
				Math.ceil(((cx + 1) / columns) * mask.width),
			);
			search: for (let my = my0; my < my1; my++) {
				for (let mx = mx0; mx < mx1; mx++) {
					if (mask.filled[my * mask.width + mx]) {
						cells[cy * columns + cx] = 1;
						break search;
					}
				}
			}
		}
	}
	return cells;
}

function pack(
	sized: readonly SizedTile[],
	scale: number,
	cell: number,
	columns: number,
	rows: number,
	candidates: Int32Array,
	strict: boolean,
): CollageLayout {
	const taken = new Uint8Array(columns * rows);
	const owners = new Int16Array(columns * rows).fill(-1);
	const placements: CollagePlacement[] = [];

	for (const { tile, index, width, height } of sized) {
		const tw = Math.max(1, Math.round((width * scale) / cell));
		const th = Math.max(1, Math.round((height * scale) / cell));
		if (tw > columns || th > rows) continue;
		const cells = rasterize(tile.mask, tw, th);
		const spot = findSpot(cells, tw, th, taken, columns, rows, candidates);
		if (!spot) {
			if (strict) break;
			continue;
		}
		stamp(
			cells,
			tw,
			th,
			taken,
			owners,
			columns,
			rows,
			spot.left,
			spot.top,
			index,
		);
		placements.push({
			key: tile.key,
			x: spot.left * cell,
			y: spot.top * cell,
			width: tw * cell,
			height: th * cell,
		});
	}
	return { placements, cell, columns, owners, view: IDENTITY_VIEW };
}

function findSpot(
	cells: Uint8Array,
	width: number,
	height: number,
	taken: Uint8Array,
	columns: number,
	rows: number,
	candidates: Int32Array,
): { left: number; top: number } | null {
	if (width > columns || height > rows) return null;
	const offsets = filledOffsets(cells, width, height, columns);
	const first = offsets[0] ?? 0;
	const halfWidth = Math.floor(width / 2);
	const halfHeight = Math.floor(height / 2);
	const maxLeft = columns - width;
	const maxTop = rows - height;
	const count = offsets.length;
	search: for (let i = 0; i < candidates.length; i++) {
		const centre = candidates[i];
		const top = ((centre / columns) | 0) - halfHeight;
		if (top < 0 || top > maxTop) continue;
		const left = centre - (top + halfHeight) * columns - halfWidth;
		if (left < 0 || left > maxLeft) continue;
		const origin = top * columns + left;
		if (taken[origin + first]) continue;
		for (let j = 1; j < count; j++) {
			if (taken[origin + offsets[j]]) continue search;
		}
		return { left, top };
	}
	return null;
}

function filledOffsets(
	cells: Uint8Array,
	width: number,
	height: number,
	columns: number,
): Int32Array {
	const found: { offset: number; distance: number }[] = [];
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			if (!cells[y * width + x]) continue;
			found.push({
				offset: y * columns + x,
				distance: (x - width / 2) ** 2 + (y - height / 2) ** 2,
			});
		}
	}
	found.sort((a, b) => a.distance - b.distance);
	return Int32Array.from(found, (cell) => cell.offset);
}

function stamp(
	cells: Uint8Array,
	tw: number,
	th: number,
	taken: Uint8Array,
	owners: Int16Array,
	columns: number,
	rows: number,
	left: number,
	top: number,
	index: number,
) {
	for (let y = 0; y < th; y++) {
		for (let x = 0; x < tw; x++) {
			if (!cells[y * tw + x]) continue;
			const gx = left + x;
			const gy = top + y;
			const at = gy * columns + gx;
			owners[at] = index;
			taken[at] = 1;
			if (gx > 0) taken[at - 1] = 1;
			if (gx < columns - 1) taken[at + 1] = 1;
			if (gy > 0) taken[at - columns] = 1;
			if (gy < rows - 1) taken[at + columns] = 1;
		}
	}
}

function fitted(
	layout: CollageLayout,
	width: number,
	height: number,
): CollageLayout {
	if (layout.placements.length === 0) return layout;
	const { cell, columns } = layout;
	let minX = Number.POSITIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let maxX = 0;
	let maxY = 0;
	for (let i = 0; i < layout.owners.length; i++) {
		if (layout.owners[i] < 0) continue;
		const x = i % columns;
		const y = Math.floor(i / columns);
		minX = Math.min(minX, x);
		minY = Math.min(minY, y);
		maxX = Math.max(maxX, x + 1);
		maxY = Math.max(maxY, y + 1);
	}
	const spanX = (maxX - minX) * cell;
	const spanY = (maxY - minY) * cell;
	const zoom = Math.min(MAX_ZOOM, width / spanX, height / spanY);
	const view = {
		zoom,
		fromX: minX * cell,
		fromY: minY * cell,
		toX: (width - spanX * zoom) / 2,
		toY: (height - spanY * zoom) / 2,
	};
	return {
		...layout,
		view,
		placements: layout.placements.map((p) => ({
			...p,
			x: (p.x - view.fromX) * zoom + view.toX,
			y: (p.y - view.fromY) * zoom + view.toY,
			width: p.width * zoom,
			height: p.height * zoom,
		})),
	};
}

export function ownerAt(layout: CollageLayout, x: number, y: number): number {
	const { zoom, fromX, fromY, toX, toY } = layout.view;
	const cx = Math.floor(((x - toX) / zoom + fromX) / layout.cell);
	const cy = Math.floor(((y - toY) / zoom + fromY) / layout.cell);
	if (cx < 0 || cy < 0 || cx >= layout.columns) return -1;
	return layout.owners[cy * layout.columns + cx] ?? -1;
}
