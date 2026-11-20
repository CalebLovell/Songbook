import { execFileSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	realpathSync,
	writeFileSync,
} from "node:fs";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig, type Plugin } from "vite";

import { DEV_PASSWORD } from "./src/lib/dev-password.ts";
import { DEFAULT_SITE_NAME } from "./src/lib/health-data.ts";

/**
 * Gives `npm run dev` a station password of its own: a file inside the
 * project (`.dev/`, gitignored), holding `DEV_PASSWORD`, created on start if
 * it's missing -- so delete it to test the "no password yet" screen, and
 * restart to get it back. `apply: "serve"` keeps this out of the production
 * build entirely; a real station still has no default password.
 */
function devStationPassword(): Plugin {
	return {
		name: "birdnet-dev-station-password",
		apply: "serve",
		config() {
			const file = path.resolve(".dev/auth.conf");
			process.env.BIRDNET_AUTH_CONF ??= file;
			if (process.env.BIRDNET_AUTH_CONF !== file || existsSync(file)) return;
			mkdirSync(path.dirname(file), { recursive: true });
			// The same tool the Pi sets its password with, rather than importing
			// the app's auth code here: Vite loads this file before the app's
			// import aliases exist.
			execFileSync(
				process.execPath,
				["--import", "tsx", "src/lib/set-password-cli.ts"],
				{
					input: DEV_PASSWORD,
					env: process.env,
					stdio: ["pipe", "ignore", "inherit"],
				},
			);
		},
	};
}

const DEV_STATION_LOCATION = {
	LATITUDE: "42.4440",
	LONGITUDE: "-76.5019",
	LOCATION_PLACE: '"Ithaca, NY"',
};

/**
 * Gives `npm run dev` a BirdNET config of its own (`.dev/birdnet.conf`), as a
 * fresh install writes it after guessing the location from its IP, so Health
 * and Settings have a station name and location to show and edit, and the
 * timeline has sunrise and sunset. A config still at 0, 0 gets the same
 * guessed location on start. Delete it to start over. Saving never touches
 * the system: dev skips the service restarts and time zone changes.
 */
function devStationConfig(): Plugin {
	return {
		name: "birdnet-dev-station-config",
		apply: "serve",
		config() {
			process.env.BIRDNET_SKIP_SYSTEM_ACTIONS ??= "1";
			const file = path.resolve(".dev/birdnet.conf");
			process.env.BIRDNET_CONF ??= file;
			if (process.env.BIRDNET_CONF !== file) return;
			if (existsSync(file)) {
				guessDevLocationIfUnset(file);
				return;
			}
			mkdirSync(path.dirname(file), { recursive: true });
			writeFileSync(
				file,
				[
					`SITE_NAME="${DEFAULT_SITE_NAME}"`,
					`LATITUDE=${DEV_STATION_LOCATION.LATITUDE}`,
					`LONGITUDE=${DEV_STATION_LOCATION.LONGITUDE}`,
					"LOCATION_SOURCE=ip",
					`LOCATION_PLACE=${DEV_STATION_LOCATION.LOCATION_PLACE}`,
					"",
				].join("\n"),
			);
		},
	};
}

function guessDevLocationIfUnset(file: string) {
	const text = readFileSync(file, "utf8");
	const coordinate = (key: string) =>
		Number(new RegExp(`^${key}=(.*)$`, "m").exec(text)?.[1] ?? 0);
	if (coordinate("LATITUDE") !== 0 || coordinate("LONGITUDE") !== 0) return;
	let updated = text;
	for (const [key, value] of Object.entries(DEV_STATION_LOCATION)) {
		const line = new RegExp(`^${key}=.*$`, "m");
		updated = line.test(updated)
			? updated.replace(line, `${key}=${value}`)
			: `${updated.replace(/\n?$/, "\n")}${key}=${value}\n`;
	}
	updated = /^LOCATION_SOURCE=/m.test(updated)
		? updated.replace(/^LOCATION_SOURCE=.*$/m, "LOCATION_SOURCE=ip")
		: `${updated}LOCATION_SOURCE=ip\n`;
	writeFileSync(file, updated);
}

// Run from the real folder even when started through a link to it (the old
// BirdNET-Pi-Live path is a junction to this checkout): Vite and Nitro take
// their root from the working directory, Node resolves modules by real path,
// and when the two disagree the dev server can't load its own entry files.
process.chdir(realpathSync.native(process.cwd()));

const config = defineConfig({
	root: process.cwd(),
	// PORT lets a harness hand the dev server a free port when 3000 is taken;
	// plain `npm run dev` still lands on 3000, which is what the launch config
	// and every bookmarked localhost URL expect.
	server: { port: Number(process.env.PORT) || 3000 },
	resolve: { tsconfigPaths: true },
	plugins: [
		devStationPassword(),
		devStationConfig(),
		nitro({
			plugins: ["./src/server-plugins/voice-check.ts"],
			rollupConfig: { external: [/^@sentry\//] },
			compressPublicAssets: { gzip: true, brotli: true },
			routeRules: {
				"/illustrations/**": {
					headers: {
						"cache-control":
							"public, max-age=604800, stale-while-revalidate=2592000",
					},
				},
			},
		}),
		tailwindcss(),
		tanstackStart({
			// Every page's code ships in the first download rather than one
			// lazily-fetched chunk per route. A route's chunk was requested on the
			// first click into it, from the same Node process that runs the
			// (synchronous) SQLite queries -- so a click during a slow query waited
			// on it before the page could switch. The app is small enough that
			// loading it whole is cheaper than that wait.
			router: {
				codeSplittingOptions: { defaultBehavior: [] },
				routeTreeFileHeader: [
					"// @ts-nocheck",
					"// noinspection JSUnusedGlobalSymbols",
				],
			},
		}),
		viteReact(),
	],
});

export default config;
