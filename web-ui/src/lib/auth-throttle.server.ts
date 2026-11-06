import "@tanstack/react-start/server-only";

import { readFile, writeFile } from "node:fs/promises";
import { isPrivateAddress } from "./auth-policy.server.ts";

export const FREE_ATTEMPTS = 5;
const MAX_BACKOFF_MS = 900_000;
export const GLOBAL_CEILING = 50;
const GLOBAL_WINDOW_MS = 900_000;

type IpState = { failures: number; until: number; seen: number };
export type ThrottleState = {
	ips: Record<string, IpState>;
	global: { failures: number; windowStart: number };
};

function emptyState(): ThrottleState {
	return { ips: Object.create(null), global: { failures: 0, windowStart: 0 } };
}

function prune(ips: Record<string, IpState>, now: number) {
	const kept: Record<string, IpState> = Object.create(null);
	for (const key of Object.keys(ips)) {
		const entry = ips[key];
		if (entry.until > now || now - entry.seen < GLOBAL_WINDOW_MS) {
			kept[key] = entry;
		}
	}
	return kept;
}

function sanitizeIps(ips: unknown): Record<string, IpState> {
	const safe: Record<string, IpState> = Object.create(null);
	if (!ips || typeof ips !== "object") return safe;
	for (const key of Object.keys(ips)) {
		if (key === "__proto__" || key === "constructor" || key === "prototype")
			continue;
		const value = (ips as Record<string, unknown>)[key] as Partial<IpState>;
		if (
			value &&
			typeof value === "object" &&
			Number.isFinite(value.failures) &&
			Number.isFinite(value.until)
		) {
			safe[key] = {
				failures: value.failures as number,
				until: value.until as number,
				seen: Number.isFinite(value.seen) ? (value.seen as number) : Date.now(),
			};
		}
	}
	return safe;
}

export class UnlockThrottle {
	readonly #statePath: string;
	readonly #now: () => number;
	#state: ThrottleState | undefined;

	constructor(options: { statePath: string; now?: () => number }) {
		this.#statePath = options.statePath;
		this.#now = options.now ?? Date.now;
	}

	async #load(): Promise<ThrottleState> {
		if (this.#state) return this.#state;
		try {
			const parsed = JSON.parse(await readFile(this.#statePath, "utf8")) as {
				ips?: unknown;
				global?: ThrottleState["global"];
			};
			const global = parsed.global as Partial<ThrottleState["global"]>;
			this.#state = {
				ips: sanitizeIps(parsed.ips),
				global:
					global &&
					typeof global === "object" &&
					Number.isFinite(global.failures) &&
					Number.isFinite(global.windowStart)
						? {
								failures: global.failures as number,
								windowStart: global.windowStart as number,
							}
						: { failures: 0, windowStart: 0 },
			};
		} catch {
			this.#state = emptyState();
		}
		return this.#state;
	}

	async #save(state: ThrottleState) {
		this.#state = state;
		try {
			await writeFile(this.#statePath, JSON.stringify(state), {
				encoding: "utf8",
				mode: 0o600,
			});
		} catch {}
	}

	async check(ip: string) {
		const state = await this.#load();
		const now = this.#now();

		const inWindow = now - state.global.windowStart < GLOBAL_WINDOW_MS;
		if (
			!isPrivateAddress(ip) &&
			inWindow &&
			state.global.failures >= GLOBAL_CEILING
		) {
			return {
				allowed: false,
				retryAfterMs: state.global.windowStart + GLOBAL_WINDOW_MS - now,
			};
		}

		const entry = state.ips[ip];
		if (entry && entry.until > now) {
			return { allowed: false, retryAfterMs: entry.until - now };
		}
		return { allowed: true, retryAfterMs: 0 };
	}

	async recordFailure(ip: string) {
		const state = await this.#load();
		const now = this.#now();

		if (!isPrivateAddress(ip)) {
			if (now - state.global.windowStart >= GLOBAL_WINDOW_MS) {
				state.global = { failures: 0, windowStart: now };
			}
			state.global.failures += 1;
		}

		const failures = (state.ips[ip]?.failures ?? 0) + 1;
		const over = failures - FREE_ATTEMPTS;
		const until =
			over >= 0 ? now + Math.min(MAX_BACKOFF_MS, 30_000 * 2 ** over) : 0;
		state.ips[ip] = { failures, until, seen: now };
		state.ips = prune(state.ips, now);

		await this.#save(state);
	}

	async recordSuccess(ip: string) {
		const state = await this.#load();
		delete state.ips[ip];
		await this.#save(state);
	}
}
