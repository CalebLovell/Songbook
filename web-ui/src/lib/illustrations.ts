import {
	PAINTED_BOUNDS,
	PAINTED_FLIGHT_SLUGS,
	PAINTED_SLUGS,
	type PaintedBounds,
} from "~/lib/painted-species.ts";
import { PAINTED_SPECIES_PHOTOS } from "~/lib/painted-species-photos.ts";
import { REFERENCE_PHOTOS } from "~/lib/reference-photos.ts";

export type IllustrationPose = "perched" | "flight";

export const ARTWORK_PREFERENCES = ["illustrations", "photos"] as const;
export type ArtworkPreference = (typeof ARTWORK_PREFERENCES)[number];
export const DEFAULT_ARTWORK_PREFERENCE: ArtworkPreference = "illustrations";

function slugify(sciName: string): string {
	return sciName.trim().toLowerCase().replaceAll(/\s+/g, "-");
}

export function illustrationUrlFor(
	sciName: string,
	pose: IllustrationPose = "perched",
	photos: Record<string, string> = REFERENCE_PHOTOS,
): string | null {
	const slug = slugify(sciName);
	if (!PAINTED_SLUGS.has(slug)) return photos[slug] ?? null;
	const flight = pose === "flight" && PAINTED_FLIGHT_SLUGS.has(slug);
	return `/illustrations/${slug}${flight ? "-2" : ""}.webp`;
}

export function isPhotoUrl(url: string): boolean {
	return url.startsWith("https://") || url.startsWith("/photos/");
}

export function photoInPlaceOfPainting(
	imageUrl: string,
	photos: Record<string, string> = REFERENCE_PHOTOS,
): string {
	const slug = imageUrl.match(
		/^\/illustrations\/([a-z0-9-]+?)(?:-2)?\.webp$/,
	)?.[1];
	if (!slug) return imageUrl;
	if (PAINTED_SPECIES_PHOTOS.has(slug)) return `/photos/${slug}.webp`;
	return photos[slug] ?? imageUrl;
}

export function paintedBoundsFor(imageUrl: string): PaintedBounds | null {
	const stem = imageUrl.match(/^\/illustrations\/([a-z0-9-]+)\.webp$/)?.[1];
	return (stem && PAINTED_BOUNDS[stem]) || null;
}
