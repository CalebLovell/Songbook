import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SongbookWordmark } from "../src/components/sidebar/songbook-wordmark.tsx";

/**
 * Renders the link-preview image and the home-screen icons into public/.
 * Run with `npm run link-images`. The inputs are the app's real wordmark and
 * logo, so nothing here is drawn by an image model. Commit the output.
 */

const PUBLIC_DIR = path.resolve("public");
const PAPER = "#fbfdf6";
const MOSS = "#203b14";
const BARK = "#472f1d";
const SAND = "#c69a58";
// Android crops a maskable icon to any shape inside the middle 80% circle.
const MASKABLE_LOGO_SHARE = 0.56;

const publicUrl = (file: string) =>
	pathToFileURL(path.join(PUBLIC_DIR, file)).href;

function previewCard(): string {
	const wordmark = renderToStaticMarkup(createElement(SongbookWordmark));
	return `<!doctype html><html><head><meta charset="utf-8"><style>
		* { margin: 0; box-sizing: border-box; }
		:root { --bark: ${BARK}; --sand: ${SAND}; }
		body { width: 1200px; height: 630px; overflow: hidden; background: ${PAPER};
			font-family: Georgia, 'Times New Roman', serif; display: flex;
			flex-direction: column; align-items: center; justify-content: center; }
		.wordmark { font-size: 162px; line-height: 0; color: ${MOSS}; }
		p { margin-top: 18px; font-size: 38px; line-height: 1.3; color: ${BARK}; }
	</style></head><body>
		<div class="wordmark">${wordmark}</div>
		<p>A record of every bird singing in your yard.</p>
	</body></html>`;
}

function icon(size: number, logoShare = 0.78): string {
	const logo = Math.round(size * logoShare);
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
	{
		file: "icon-maskable-512.png",
		width: 512,
		height: 512,
		html: icon(512, MASKABLE_LOGO_SHARE),
	},
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
