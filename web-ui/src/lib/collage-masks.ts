import type { CollageMask } from "~/lib/collage-layout.ts";
import type { PaintedBounds } from "~/lib/painted-species.ts";

const PAINTING_SIDE = 480;
const MASK_LONG_SIDE = 72;
const ALPHA_FLOOR = 48;

const masks = new Map<string, Promise<CollageMask>>();

export function maskFor(
	imageUrl: string,
	bounds: PaintedBounds,
): Promise<CollageMask> {
	let mask = masks.get(imageUrl);
	if (!mask) {
		mask = loadMask(imageUrl, bounds).catch((error) => {
			masks.delete(imageUrl);
			throw error;
		});
		masks.set(imageUrl, mask);
	}
	return mask;
}

async function loadMask(
	imageUrl: string,
	[bx, by, bw, bh]: PaintedBounds,
): Promise<CollageMask> {
	const image = new Image();
	image.decoding = "async";
	image.src = imageUrl;
	await image.decode();

	const ratio = Math.min(1, MASK_LONG_SIDE / Math.max(bw, bh));
	const width = Math.max(1, Math.round(bw * ratio));
	const height = Math.max(1, Math.round(bh * ratio));
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const context = canvas.getContext("2d", { willReadFrequently: true });
	if (!context) return solidMask(width, height);

	const source = image.naturalWidth / PAINTING_SIDE;
	context.drawImage(
		image,
		bx * source,
		by * source,
		bw * source,
		bh * source,
		0,
		0,
		width,
		height,
	);
	const pixels = context.getImageData(0, 0, width, height).data;
	const filled = new Uint8Array(width * height);
	for (let i = 0; i < filled.length; i++) {
		filled[i] = pixels[i * 4 + 3] >= ALPHA_FLOOR ? 1 : 0;
	}
	return { width, height, filled };
}

function solidMask(width: number, height: number): CollageMask {
	return { width, height, filled: new Uint8Array(width * height).fill(1) };
}
