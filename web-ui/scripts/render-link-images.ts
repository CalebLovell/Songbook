import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

/**
 * Renders the link-preview image and the home-screen icons into public/.
 * Run with `npm run link-images`. The inputs are the real logo and paintings,
 * so nothing here is drawn by an image model. Commit the output.
 */

const PUBLIC_DIR = path.resolve("public");
const PAPER = "#fbfdf6";
const MOSS = "#203b14";
const BARK = "#472f1d";

const publicUrl = (file: string) =>
	pathToFileURL(path.join(PUBLIC_DIR, file)).href;
const painting = (slug: string) => publicUrl(`illustrations/${slug}.webp`);

function previewCard(): string {
	return `<!doctype html><html><head><meta charset="utf-8"><style>
		* { margin: 0; box-sizing: border-box; }
		body { width: 1200px; height: 630px; overflow: hidden; position: relative;
			background: ${PAPER}; font-family: Georgia, 'Times New Roman', serif; }
		.copy { position: absolute; left: 72px; top: 0; bottom: 0; width: 500px;
			display: flex; flex-direction: column; justify-content: center; }
		.logo { width: 148px; height: 148px; margin-left: -6px; }
		h1 { margin-top: 12px; font-size: 92px; font-weight: 700; line-height: 1;
			letter-spacing: -0.01em; color: ${MOSS}; }
		p { margin-top: 24px; font-size: 34px; line-height: 1.3; color: ${BARK}; }
		.bird { position: absolute; }
	</style></head><body>
		<div class="copy">
			<img class="logo" src="${publicUrl("songbook.svg")}" alt="">
			<h1>Songbook</h1>
			<p>A record of every bird singing in your yard, on a Raspberry Pi.</p>
		</div>
		<img class="bird" style="width:350px;left:795px;top:-14px" src="${painting("cyanocitta-cristata")}" alt="">
		<img class="bird" style="width:320px;left:575px;top:200px" src="${painting("spinus-tristis")}" alt="">
		<img class="bird" style="width:370px;left:825px;top:262px" src="${painting("cardinalis-cardinalis")}" alt="">
	</body></html>`;
}

function icon(size: number): string {
	const logo = Math.round(size * 0.78);
	return `<!doctype html><html><head><meta charset="utf-8"><style>
		* { margin: 0; }
		body { width: ${size}px; height: ${size}px; background: ${PAPER};
			display: grid; place-items: center; overflow: hidden; }
		img { width: ${logo}px; height: ${logo}px; }
	</style></head><body><img src="${publicUrl("songbook.svg")}" alt=""></body></html>`;
}

const IMAGES = [
	{ file: "og-image.png", width: 1200, height: 630, html: previewCard() },
	{ file: "apple-touch-icon.png", width: 180, height: 180, html: icon(180) },
	{ file: "icon-192.png", width: 192, height: 192, html: icon(192) },
	{ file: "icon-512.png", width: 512, height: 512, html: icon(512) },
];

const templateDir = await mkdtemp(path.join(tmpdir(), "songbook-link-images-"));
const browser = await chromium.launch();
try {
	for (const { file, width, height, html } of IMAGES) {
		const page = await browser.newPage({ viewport: { width, height } });
		const template = path.join(templateDir, `${file}.html`);
		await writeFile(template, html);
		await page.goto(pathToFileURL(template).href, { waitUntil: "networkidle" });
		const output = path.join(PUBLIC_DIR, file);
		await page.screenshot({ path: output, type: "png" });
		await page.close();
		const bytes = (await readFile(output)).byteLength;
		console.log(`${file}: ${Math.round(bytes / 1024)} KB`);
	}
} finally {
	await browser.close();
	await rm(templateDir, { recursive: true, force: true });
}
