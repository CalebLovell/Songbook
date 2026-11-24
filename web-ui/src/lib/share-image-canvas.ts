import type { ShownCollageBird } from "~/lib/collage-birds.ts";
import { type CollageTile, layoutCollage } from "~/lib/collage-layout.ts";
import { maskForBird } from "~/lib/collage-masks.ts";
import {
	SHARE_IMAGE_HEIGHT,
	SHARE_IMAGE_WIDTH,
	type ShareImageArt,
	type ShareImageModel,
	type ShareImageRow,
} from "~/lib/share-image.ts";
import {
	fitSize,
	type MeasureText,
	truncate,
	wrapLines,
} from "~/lib/share-image-text.ts";

const FONT_STACK = "Georgia, 'Times New Roman', serif";
const PAINTING_SIDE = 480;
const MARGIN = 96;
const CONTENT_WIDTH = SHARE_IMAGE_WIDTH - MARGIN * 2;
const COLLAGE_WIDTH = SHARE_IMAGE_WIDTH - MARGIN;
const EDGE = MARGIN * 0.75;
const KICKER_TRACKING = 0.16;
const BLOCK_GAP = 44;
const PHOTO_RADIUS = 12;
const NAME_WEIGHT = 600;

const COLOR_TOKENS = [
	"--paper",
	"--moss",
	"--muted-foreground",
	"--line",
] as const;
export type ShareImageColors = Record<(typeof COLOR_TOKENS)[number], string>;

type Weight = "normal" | "bold" | typeof NAME_WEIGHT;
type Ctx = CanvasRenderingContext2D;
type Align = "left" | "center" | "right";
type Block = { height: number; draw: (ctx: Ctx, top: number) => void };

export function readShareImageColors(): ShareImageColors {
	const probe = document.createElement("span");
	probe.style.display = "none";
	document.body.append(probe);
	const colors = Object.fromEntries(
		COLOR_TOKENS.map((token) => {
			probe.style.color = `var(${token})`;
			return [token, getComputedStyle(probe).color];
		}),
	) as ShareImageColors;
	probe.remove();
	return colors;
}

function font(size: number, weight: Weight = "normal"): string {
	return `${weight} ${size}px ${FONT_STACK}`;
}

function measurer(ctx: Ctx, weight: Weight): MeasureText {
	return (text, size) => {
		ctx.font = font(size, weight);
		return ctx.measureText(text).width;
	};
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
	const image = new Image();
	if (url.startsWith("https://")) image.crossOrigin = "anonymous";
	image.decoding = "async";
	image.src = url;
	return image.decode().then(
		() => image,
		() => null,
	);
}

function text(
	ctx: Ctx,
	value: string,
	x: number,
	y: number,
	{
		size,
		weight = "normal",
		color,
		align = "left",
	}: { size: number; weight?: Weight; color: string; align?: Align },
) {
	ctx.font = font(size, weight);
	ctx.fillStyle = color;
	ctx.textAlign = align;
	ctx.fillText(value, x, y);
}

function trackedWidth(ctx: Ctx, value: string, size: number): number {
	ctx.font = font(size, "bold");
	const letters = [...value.toUpperCase()];
	return (
		letters.reduce((sum, letter) => sum + ctx.measureText(letter).width, 0) +
		size * KICKER_TRACKING * (letters.length - 1)
	);
}

function kicker(
	ctx: Ctx,
	value: string,
	x: number,
	y: number,
	size: number,
	color: string,
	align: Align = "left",
) {
	const total = trackedWidth(ctx, value, size);
	ctx.font = font(size, "bold");
	ctx.fillStyle = color;
	ctx.textAlign = "left";
	let cursor =
		align === "left" ? x : align === "center" ? x - total / 2 : x - total;
	for (const letter of value.toUpperCase()) {
		ctx.fillText(letter, cursor, y);
		cursor += ctx.measureText(letter).width + size * KICKER_TRACKING;
	}
}

type Box = { x: number; y: number; width: number; height: number };

function drawArt(
	ctx: Ctx,
	art: ShareImageArt,
	image: HTMLImageElement | null,
	box: Box,
) {
	if (!art || !image) return;

	if (art.kind === "photo") {
		const side = Math.min(box.width, box.height);
		const x = box.x + (box.width - side) / 2;
		const y = box.y + (box.height - side) / 2;
		const crop = Math.min(image.naturalWidth, image.naturalHeight);
		ctx.save();
		ctx.beginPath();
		ctx.roundRect(x, y, side, side, PHOTO_RADIUS);
		ctx.clip();
		ctx.drawImage(
			image,
			(image.naturalWidth - crop) / 2,
			(image.naturalHeight - crop) / 2,
			crop,
			crop,
			x,
			y,
			side,
			side,
		);
		ctx.restore();
		return;
	}

	const scale = image.naturalWidth / PAINTING_SIDE;
	const [bx, by, bw, bh] = art.bounds;
	const fit = Math.min(box.width / bw, box.height / bh);
	const width = bw * fit;
	const height = bh * fit;
	ctx.drawImage(
		image,
		bx * scale,
		by * scale,
		bw * scale,
		bh * scale,
		box.x + (box.width - width) / 2,
		box.y + (box.height - height) / 2,
		width,
		height,
	);
}

const CAP_HEIGHT = 0.72;
const STATION_DROP = 52;
const STATION_SIZE = 36;

function headerBlock(
	ctx: Ctx,
	model: ShareImageModel,
	colors: ShareImageColors,
): Block {
	const titleSize = fitSize(
		measurer(ctx, "bold"),
		[model.title],
		CONTENT_WIDTH,
		84,
		36,
	);
	const titleHeight = Math.ceil(titleSize * CAP_HEIGHT);
	return {
		height: titleHeight + (model.stationName ? STATION_DROP : 0),
		draw(ctx, top) {
			const titleBaseline = top + titleHeight;
			text(ctx, model.title, MARGIN - 3, titleBaseline, {
				size: titleSize,
				weight: "bold",
				color: colors["--moss"],
			});
			if (model.stationName) {
				const name = truncate(
					measurer(ctx, "normal"),
					model.stationName,
					STATION_SIZE,
					CONTENT_WIDTH,
				);
				text(ctx, name, MARGIN, titleBaseline + STATION_DROP, {
					size: STATION_SIZE,
					color: colors["--muted-foreground"],
				});
			}
		},
	};
}

type LoadedCollageBird = {
	art: Exclude<ShareImageArt, null>;
	image: HTMLImageElement;
	tile: CollageTile;
};

const loadedCollages = new WeakMap<
	readonly ShownCollageBird[],
	Promise<LoadedCollageBird[]>
>();

function sharedCollage(
	birds: readonly ShownCollageBird[],
): Promise<LoadedCollageBird[]> {
	let loaded = loadedCollages.get(birds);
	if (!loaded) {
		loaded = loadCollage(birds);
		loadedCollages.set(birds, loaded);
	}
	return loaded;
}

async function loadCollage(
	birds: readonly ShownCollageBird[],
): Promise<LoadedCollageBird[]> {
	const loaded = await Promise.all(
		birds.map(async (bird): Promise<LoadedCollageBird | null> => {
			if (!bird.imageUrl) return null;
			const [image, mask] = await Promise.all([
				loadImage(bird.imageUrl),
				maskForBird(bird),
			]);
			if (!image) return null;
			return {
				art:
					bird.kind === "painting"
						? { kind: "painting", url: bird.imageUrl, bounds: bird.bounds }
						: { kind: "photo", url: bird.imageUrl },
				image,
				tile: { key: bird.comName, count: bird.count, mask },
			};
		}),
	);
	return loaded.filter((bird) => bird !== null);
}

function collageBlock(birds: LoadedCollageBird[], height: number): Block {
	const layout = layoutCollage(
		birds.map((bird) => bird.tile),
		COLLAGE_WIDTH,
		height,
	);
	const byKey = new Map(birds.map((bird) => [bird.tile.key, bird]));
	return {
		height,
		draw(ctx, top) {
			const left = (SHARE_IMAGE_WIDTH - COLLAGE_WIDTH) / 2;
			for (const placement of layout.placements) {
				const bird = byKey.get(placement.key);
				if (!bird) continue;
				drawArt(ctx, bird.art, bird.image, {
					x: left + placement.x,
					y: top + placement.y,
					width: placement.width,
					height: placement.height,
				});
			}
		},
	};
}

const ROW_HEIGHT = 88;
const ROW_ART = 76;
const ROW_NAME_SIZE = 40;
const ROW_LINE_HEIGHT = 42;
const ROW_COUNT_SIZE = 36;
const ROW_GAP = 32;
const LABEL_SIZE = 24;

function drawRowEnd(
	ctx: Ctx,
	row: ShareImageRow,
	mid: number,
	colors: ShareImageColors,
): number {
	const right = SHARE_IMAGE_WIDTH - MARGIN;
	const color = colors["--muted-foreground"];
	if (row.kind === "highlight") {
		kicker(ctx, row.label, right, mid + 9, LABEL_SIZE, color, "right");
		return trackedWidth(ctx, row.label, LABEL_SIZE);
	}
	text(ctx, row.count, right, mid + 13, {
		size: ROW_COUNT_SIZE,
		color,
		align: "right",
	});
	return measurer(ctx, "normal")(row.count, ROW_COUNT_SIZE);
}

function rowsBlock(
	rows: ShareImageRow[],
	images: (HTMLImageElement | null)[],
	colors: ShareImageColors,
): Block {
	return {
		height: rows.length * ROW_HEIGHT,
		draw(ctx, top) {
			const nameMeasure = measurer(ctx, NAME_WEIGHT);
			for (const [index, row] of rows.entries()) {
				const mid = top + (index + 0.5) * ROW_HEIGHT;
				drawArt(ctx, row.art, images[index], {
					x: MARGIN,
					y: mid - ROW_ART / 2,
					width: ROW_ART,
					height: ROW_ART,
				});

				const endWidth = drawRowEnd(ctx, row, mid, colors);
				const nameX = MARGIN + ROW_ART + ROW_GAP;
				const lines = wrapLines(
					nameMeasure,
					row.comName,
					ROW_NAME_SIZE,
					SHARE_IMAGE_WIDTH - MARGIN - endWidth - ROW_GAP - nameX,
					2,
				);
				const first = mid + 14 - ((lines.length - 1) * ROW_LINE_HEIGHT) / 2;
				for (const [line, value] of lines.entries()) {
					text(ctx, value, nameX, first + line * ROW_LINE_HEIGHT, {
						size: ROW_NAME_SIZE,
						weight: NAME_WEIGHT,
						color: colors["--moss"],
					});
				}
			}
		},
	};
}

function statsBlock(model: ShareImageModel, colors: ShareImageColors): Block {
	return {
		height: 130,
		draw(ctx, top) {
			const columnWidth = CONTENT_WIDTH / model.stats.length;

			const size = fitSize(
				measurer(ctx, "bold"),
				model.stats.map((stat) => stat.value),
				columnWidth - 32,
				84,
				40,
			);
			const valueMeasure = measurer(ctx, "bold");
			const widths = model.stats.map((stat) =>
				Math.max(
					valueMeasure(stat.value, size),
					trackedWidth(ctx, stat.label, LABEL_SIZE),
				),
			);
			const gap =
				(CONTENT_WIDTH - widths.reduce((sum, width) => sum + width, 0)) /
				(widths.length - 1);
			let left = MARGIN;
			for (const [index, stat] of model.stats.entries()) {
				const cx = left + widths[index] / 2;
				if (index > 0) {
					ctx.fillStyle = colors["--line"];
					ctx.fillRect(left - gap / 2 - 1, top, 2, 128);
				}
				left += widths[index] + gap;
				text(ctx, stat.value, cx, top + 12 + size * 0.8, {
					size,
					weight: "bold",
					color: colors["--moss"],
					align: "center",
				});
				kicker(
					ctx,
					stat.label,
					cx,
					top + 122,
					LABEL_SIZE,
					colors["--muted-foreground"],
					"center",
				);
			}
		},
	};
}

export async function renderShareImage(
	model: ShareImageModel,
	colors: ShareImageColors = readShareImageColors(),
): Promise<Blob> {
	const [images, collage] = await Promise.all([
		Promise.all(
			model.rows.map((row) => (row.art ? loadImage(row.art.url) : null)),
		),
		sharedCollage(model.collage),
	]);

	const canvas = document.createElement("canvas");
	canvas.width = SHARE_IMAGE_WIDTH;
	canvas.height = SHARE_IMAGE_HEIGHT;
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("Canvas is unavailable");

	ctx.fillStyle = colors["--paper"];
	ctx.fillRect(0, 0, SHARE_IMAGE_WIDTH, SHARE_IMAGE_HEIGHT);
	ctx.textBaseline = "alphabetic";

	const header = headerBlock(ctx, model, colors);
	const rows = rowsBlock(model.rows, images, colors);
	const stats = statsBlock(model, colors);
	const collageHeight =
		SHARE_IMAGE_HEIGHT -
		EDGE * 2 -
		header.height -
		rows.height -
		stats.height -
		BLOCK_GAP * 3;

	let top = EDGE;
	for (const block of [
		header,
		collageBlock(collage, collageHeight),
		rows,
		stats,
	]) {
		block.draw(ctx, top);
		top += block.height + BLOCK_GAP;
	}

	return new Promise((resolve, reject) =>
		canvas.toBlob(
			(blob) =>
				blob ? resolve(blob) : reject(new Error("Could not encode the image")),
			"image/png",
		),
	);
}
