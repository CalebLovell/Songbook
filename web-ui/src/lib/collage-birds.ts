import {
	type IllustrationPose,
	illustrationUrlFor,
	paintedBoundsFor,
} from "~/lib/illustrations.ts";
import type { PaintedBounds } from "~/lib/painted-species.ts";

export const FLYING_SHARE = 0.25;

export type CollagePainting = { imageUrl: string; bounds: PaintedBounds };

export type CollageBird = {
	comName: string;
	sciName: string;
	count: number;
	perched: CollagePainting;
	flight: CollagePainting | null;
};

type ShownBase = Omit<CollageBird, "perched" | "flight">;

export type ShownCollageBird =
	| (ShownBase & CollagePainting & { kind: "painting" })
	| (ShownBase & { kind: "photo"; imageUrl: string | null });

export function randomMixSeed(): number {
	return Math.floor(Math.random() * 0x100000000);
}

export function flyingNames(
	birds: readonly CollageBird[],
	mixSeed: number,
): Set<string> {
	const bySize = birds
		.filter((bird) => bird.flight)
		.sort((a, b) => b.count - a.count || a.comName.localeCompare(b.comName));
	const fliers = Math.round(bySize.length * FLYING_SHARE);
	const flying = new Set<string>();
	if (fliers === 0) return flying;

	const random = seededRandom(mixSeed);
	const band = bySize.length / fliers;
	for (let i = 0; i < fliers; i++) {
		const from = Math.floor(i * band);
		const to = Math.floor((i + 1) * band);
		const pick = from + Math.floor(random() * Math.max(1, to - from));
		flying.add(bySize[Math.min(pick, bySize.length - 1)].comName);
	}
	return flying;
}

export function showCollageBirds(
	birds: readonly CollageBird[],
	mixSeed: number,
): ShownCollageBird[] {
	const flying = flyingNames(birds, mixSeed);
	return birds.map(({ perched, flight, ...rest }) => ({
		...rest,
		...(flight && flying.has(rest.comName) ? flight : perched),
		kind: "painting",
	}));
}

function seededRandom(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
	};
}

export type CollageSource = { comName: string; sciName: string; count: number };

export function collageBirdsFrom(
	species: readonly CollageSource[],
): CollageBird[] {
	const birds: CollageBird[] = [];
	for (const { comName, sciName, count } of species) {
		const perched = paintingFor(sciName, "perched");
		if (!perched) continue;
		const flight = paintingFor(sciName, "flight");
		birds.push({
			comName,
			sciName,
			count,
			perched,
			flight: flight && flight.imageUrl !== perched.imageUrl ? flight : null,
		});
	}
	return birds;
}

function paintingFor(
	sciName: string,
	pose: IllustrationPose,
): CollagePainting | null {
	const imageUrl = illustrationUrlFor(sciName, pose, {});
	const bounds = imageUrl ? paintedBoundsFor(imageUrl) : null;
	return imageUrl && bounds ? { imageUrl, bounds } : null;
}

export function collagePhotosFrom(
	species: readonly CollageSource[],
): ShownCollageBird[] {
	return species.map(({ comName, sciName, count }) => ({
		comName,
		sciName,
		count,
		kind: "photo",
		imageUrl: illustrationUrlFor(sciName),
	}));
}
