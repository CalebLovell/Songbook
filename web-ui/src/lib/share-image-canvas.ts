import {
	SHARE_IMAGE_HEIGHT,
	SHARE_IMAGE_WIDTH,
	type ShareImageArt,
	type ShareImageBird,
	type ShareImageModel,
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
const KICKER_TRACKING = 0.16;
const BLOCK_GAP = 52;
const PHOTO_RADIUS = 12;
const WORDMARK_HEIGHT = 64;
const NAME_WEIGHT = 600;

const COLOR_TOKENS = [
	"--paper",
	"--ink",
	"--moss",
	"--sand",
	"--clay",
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

function medalColors(colors: ShareImageColors): string[] {
	return [colors["--sand"], colors["--muted-foreground"], colors["--clay"]];
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

function drawArt(
	ctx: Ctx,
	art: ShareImageArt,
	image: HTMLImageElement | null,
	cx: number,
	bottom: number,
	side: number,
) {
	if (!art || !image) return;

	if (art.kind === "photo") {
		const crop = Math.min(image.naturalWidth, image.naturalHeight);
		ctx.save();
		ctx.beginPath();
		ctx.roundRect(cx - side / 2, bottom - side, side, side, PHOTO_RADIUS);
		ctx.clip();
		ctx.drawImage(
			image,
			(image.naturalWidth - crop) / 2,
			(image.naturalHeight - crop) / 2,
			crop,
			crop,
			cx - side / 2,
			bottom - side,
			side,
			side,
		);
		ctx.restore();
		return;
	}

	const scale = image.naturalWidth / PAINTING_SIDE;
	const [bx, by, bw, bh] = art.bounds;
	const fit = Math.min(side / bw, side / bh);
	const width = bw * fit;
	const height = bh * fit;
	ctx.drawImage(
		image,
		bx * scale,
		by * scale,
		bw * scale,
		bh * scale,
		cx - width / 2,
		bottom - height,
		width,
		height,
	);
}

function headerBlock(
	model: ShareImageModel,
	wordmark: HTMLImageElement | null,
	colors: ShareImageColors,
): Block {
	return {
		height: model.subtitle ? 250 : 190,
		draw(ctx, top) {
			if (wordmark) {
				const width =
					(WORDMARK_HEIGHT * wordmark.naturalWidth) / wordmark.naturalHeight;
				ctx.drawImage(wordmark, MARGIN, top, width, WORDMARK_HEIGHT);
			}
			if (model.stationName) {
				const name = truncate(
					measurer(ctx, "normal"),
					model.stationName,
					30,
					480,
				);
				text(ctx, name, SHARE_IMAGE_WIDTH - MARGIN, top + 44, {
					size: 30,
					color: colors["--muted-foreground"],
					align: "right",
				});
			}

			const size = fitSize(
				measurer(ctx, "bold"),
				[model.title],
				CONTENT_WIDTH,
				92,
				56,
			);
			const titleBaseline = top + WORDMARK_HEIGHT + 34 + size;
			text(ctx, model.title, MARGIN - 3, titleBaseline, {
				size,
				weight: "bold",
				color: colors["--moss"],
			});
			if (model.subtitle) {
				text(ctx, model.subtitle, MARGIN, titleBaseline + 64, {
					size: 40,
					color: colors["--muted-foreground"],
				});
			}
		},
	};
}

const HERO_TEXT_HEIGHT = 150;

function heroBlock(
	hero: ShareImageBird,
	image: HTMLImageElement | null,
	art: number,
	colors: ShareImageColors,
): Block {
	return {
		height: art + HERO_TEXT_HEIGHT,
		draw(ctx, top) {
			const cx = SHARE_IMAGE_WIDTH / 2;
			drawArt(ctx, hero.art, image, cx, top + art, art);

			const rank = "1";
			const gap = 22;
			const nameMeasure = measurer(ctx, NAME_WEIGHT);
			const rankWidth = measurer(ctx, "bold")(rank, 60);
			const room = CONTENT_WIDTH - rankWidth - gap;
			const size = fitSize(nameMeasure, [hero.comName], room, 60, 40);
			const name = truncate(nameMeasure, hero.comName, size, room);
			const left = cx - (rankWidth + gap + nameMeasure(name, size)) / 2;
			const baseline = top + art + 50 + size;
			text(ctx, rank, left, baseline, {
				size: 60,
				weight: "bold",
				color: medalColors(colors)[0],
			});
			text(ctx, name, left + rankWidth + gap, baseline, {
				size,
				weight: NAME_WEIGHT,
				color: colors["--moss"],
			});
			text(ctx, hero.countLabel, cx, baseline + 54, {
				size: 34,
				color: colors["--muted-foreground"],
				align: "center",
			});
		},
	};
}

const ROW_HEIGHT = 124;
const ROW_ART = 92;
const ROW_NAME_SIZE = 40;

function rowsBlock(
	birds: ShareImageBird[],
	images: (HTMLImageElement | null)[],
	colors: ShareImageColors,
): Block {
	return {
		height: birds.length * ROW_HEIGHT,
		draw(ctx, top) {
			const medals = medalColors(colors);
			const nameMeasure = measurer(ctx, NAME_WEIGHT);
			const artCx = MARGIN + 70 + ROW_ART / 2;
			const nameX = artCx + ROW_ART / 2 + 32;
			for (const [index, bird] of birds.entries()) {
				const rank = index + 2;
				const rowTop = top + index * ROW_HEIGHT;
				const mid = rowTop + ROW_HEIGHT / 2;
				ctx.fillStyle = colors["--line"];
				ctx.fillRect(MARGIN, rowTop, CONTENT_WIDTH, 2);

				text(ctx, String(rank), MARGIN + 6, mid + 16, {
					size: 46,
					weight: "bold",
					color: medals[rank - 1],
				});
				drawArt(
					ctx,
					bird.art,
					images[index],
					artCx,
					mid + ROW_ART / 2,
					ROW_ART,
				);

				const count = bird.count.toLocaleString();
				const countWidth = measurer(ctx, "normal")(count, 36);
				text(ctx, count, SHARE_IMAGE_WIDTH - MARGIN, mid + 13, {
					size: 36,
					color: colors["--muted-foreground"],
					align: "right",
				});
				const nameWidth = SHARE_IMAGE_WIDTH - MARGIN - countWidth - 32 - nameX;
				const lines = wrapLines(
					nameMeasure,
					bird.comName,
					ROW_NAME_SIZE,
					nameWidth,
					2,
				);
				const lineHeight = 46;
				const first = mid + 14 - ((lines.length - 1) * lineHeight) / 2;
				for (const [line, value] of lines.entries()) {
					text(ctx, value, nameX, first + line * lineHeight, {
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
		height: 190,
		draw(ctx, top) {
			const columnWidth = CONTENT_WIDTH / model.stats.length;
			ctx.fillStyle = colors["--line"];
			ctx.fillRect(MARGIN, top, CONTENT_WIDTH, 2);
			ctx.fillRect(MARGIN, top + 188, CONTENT_WIDTH, 2);

			const size = fitSize(
				measurer(ctx, "bold"),
				model.stats.map((stat) => stat.value),
				columnWidth - 32,
				84,
				40,
			);
			for (const [index, stat] of model.stats.entries()) {
				const cx = MARGIN + columnWidth * (index + 0.5);
				if (index > 0) {
					ctx.fillStyle = colors["--line"];
					ctx.fillRect(MARGIN + columnWidth * index, top + 36, 2, 118);
				}
				text(ctx, stat.value, cx, top + 48 + size * 0.8, {
					size,
					weight: "bold",
					color: colors["--moss"],
					align: "center",
				});
				kicker(
					ctx,
					stat.label,
					cx,
					top + 148,
					24,
					colors["--muted-foreground"],
					"center",
				);
			}
		},
	};
}

const LINE_HEIGHT = 62;
const LINE_SIZE = 36;
const LABEL_SIZE = 24;

function linesBlock(model: ShareImageModel, colors: ShareImageColors): Block {
	return {
		height: 44 + model.lines.length * LINE_HEIGHT,
		draw(ctx, top) {
			kicker(ctx, "Highlights", MARGIN, top + 26, 26, colors["--moss"]);
			const labelWidth = Math.max(
				...model.lines.map((line) => trackedWidth(ctx, line.label, LABEL_SIZE)),
			);
			const textX = MARGIN + labelWidth + 32;
			const textRight = SHARE_IMAGE_WIDTH - MARGIN;
			const birdMeasure = measurer(ctx, NAME_WEIGHT);
			const plainMeasure = measurer(ctx, "normal");

			for (const [index, line] of model.lines.entries()) {
				const baseline = top + 44 + index * LINE_HEIGHT + 44;
				kicker(
					ctx,
					line.label,
					MARGIN,
					baseline - 4,
					LABEL_SIZE,
					colors["--moss"],
				);

				let x = textX;
				let rest = line.text;
				if (line.bird && rest.startsWith(line.bird)) {
					const bird = truncate(
						birdMeasure,
						line.bird,
						LINE_SIZE,
						textRight - x,
					);
					text(ctx, bird, x, baseline, {
						size: LINE_SIZE,
						weight: NAME_WEIGHT,
						color: colors["--moss"],
					});
					x += birdMeasure(bird, LINE_SIZE);
					rest = bird === line.bird ? rest.slice(line.bird.length) : "";
				}
				if (rest) {
					text(
						ctx,
						truncate(plainMeasure, rest, LINE_SIZE, textRight - x),
						x,
						baseline,
						{ size: LINE_SIZE, color: colors["--ink"] },
					);
				}
			}
		},
	};
}

export async function renderShareImage(
	model: ShareImageModel,
	wordmark: HTMLImageElement | null = null,
	colors: ShareImageColors = readShareImageColors(),
): Promise<Blob> {
	const images = await Promise.all(
		model.podium.map((bird) => (bird.art ? loadImage(bird.art.url) : null)),
	);

	const canvas = document.createElement("canvas");
	canvas.width = SHARE_IMAGE_WIDTH;
	canvas.height = SHARE_IMAGE_HEIGHT;
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("Canvas is unavailable");

	ctx.fillStyle = colors["--paper"];
	ctx.fillRect(0, 0, SHARE_IMAGE_WIDTH, SHARE_IMAGE_HEIGHT);
	ctx.textBaseline = "alphabetic";

	const [hero, ...others] = model.podium;
	const header = headerBlock(model, wordmark, colors);
	const after = [
		...(others.length > 0 ? [rowsBlock(others, images.slice(1), colors)] : []),
		statsBlock(model, colors),
		...(model.lines.length > 0 ? [linesBlock(model, colors)] : []),
	];
	const fixedHeight = [header, ...after].reduce(
		(sum, block) => sum + block.height,
		0,
	);
	const room =
		SHARE_IMAGE_HEIGHT -
		MARGIN * 1.5 -
		fixedHeight -
		BLOCK_GAP * (after.length + 1) -
		HERO_TEXT_HEIGHT;
	const heroArt = Math.max(200, Math.min(440, room));
	const blocks = [
		header,
		heroBlock(hero, images[0], heroArt, colors),
		...after,
	];

	const total =
		blocks.reduce((sum, block) => sum + block.height, 0) +
		BLOCK_GAP * (blocks.length - 1);
	let top = Math.max(MARGIN * 0.75, (SHARE_IMAGE_HEIGHT - total) / 2);
	for (const block of blocks) {
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
