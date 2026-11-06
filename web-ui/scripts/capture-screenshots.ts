import { type ChildProcess, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "@playwright/test";

/**
 * Captures the README's screenshots from seeded data, light only:
 *
 *   npm run db:reset && npm run build && npm run screenshots
 *
 * It starts the production build on its own port with a throwaway config, so
 * the shared dev server is left alone and no real station name or coordinates
 * can reach an image. Settings is never captured, for the same reason.
 */

const PORT = 5297;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const SERVER_ENTRY = path.resolve(".output/server/index.mjs");
const OUTPUT_DIR = path.resolve("../.github/assets/screenshots");
const SAMPLE_CONFIG = 'SITE_NAME="Backyard Station"\n';

const PAGES = [
	{ name: "live", path: "/live" },
	{ name: "timeline", path: "/timeline" },
	{ name: "detections", path: "/detections" },
	{ name: "birds", path: "/birds" },
	{ name: "species", path: "/birds/northern-cardinal" },
	{ name: "learn", path: "/learn" },
];

const SIZES = [
	{ name: "desktop", width: 1440, height: 900, scale: 1, mobile: false },
	{ name: "phone", width: 390, height: 844, scale: 2, mobile: true },
];

async function waitForServer(server: ChildProcess) {
	for (let attempt = 0; attempt < 60; attempt += 1) {
		if (server.exitCode !== null) break;
		const up = await fetch(`${ORIGIN}/live`).then(
			(response) => response.ok,
			() => false,
		);
		if (up) return;
		await new Promise((resolve) => setTimeout(resolve, 500));
	}
	throw new Error("The production server didn't start.");
}

if (!existsSync(SERVER_ENTRY)) {
	throw new Error("No production build found. Run `npm run build` first.");
}

const configDir = await mkdtemp(path.join(tmpdir(), "songbook-screenshots-"));
const configFile = path.join(configDir, "birdnet.conf");
await writeFile(configFile, SAMPLE_CONFIG);
await mkdir(OUTPUT_DIR, { recursive: true });

const server = spawn(process.execPath, [SERVER_ENTRY], {
	env: {
		...process.env,
		PORT: String(PORT),
		HOST: "127.0.0.1",
		BIRDNET_CONF: configFile,
		BIRDNET_DB_PATH: path.resolve("../scripts/birds.db"),
		BIRDNET_AUTH_CONF: path.join(configDir, "auth.conf"),
	},
	stdio: "ignore",
});

const browser = await chromium.launch();
try {
	await waitForServer(server);
	for (const size of SIZES) {
		const context = await browser.newContext({
			viewport: { width: size.width, height: size.height },
			deviceScaleFactor: size.scale,
			isMobile: size.mobile,
			hasTouch: size.mobile,
			colorScheme: "light",
		});
		const page = await context.newPage();
		for (const { name, path: route } of PAGES) {
			const response = await page.goto(`${ORIGIN}${route}`);
			if (!response?.ok()) {
				throw new Error(`${route} answered ${response?.status()}`);
			}
			await page
				.waitForLoadState("networkidle", { timeout: 15_000 })
				.catch(() => {});
			await page.evaluate(() => document.fonts.ready);
			const file = path.join(OUTPUT_DIR, `${name}-${size.name}.jpg`);
			await page.screenshot({
				path: file,
				type: "jpeg",
				quality: 80,
				animations: "disabled",
			});
			const { size: bytes } = await stat(file);
			console.log(`${path.basename(file)}: ${Math.round(bytes / 1024)} KB`);
		}
		await context.close();
	}
} finally {
	await browser.close();
	server.kill();
	await rm(configDir, { recursive: true, force: true });
}
