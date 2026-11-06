import {
	PAINTED_BOUNDS,
	PAINTED_FLIGHT_SLUGS,
	PAINTED_SLUGS,
	type PaintedBounds,
} from "~/lib/painted-species.ts";
import { REFERENCE_PHOTOS } from "~/lib/reference-photos.ts";

export type IllustrationPose = "perched" | "flight";

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
	return url.startsWith("https://");
}

export function paintedBoundsFor(imageUrl: string): PaintedBounds | null {
	const stem = imageUrl.match(/^\/illustrations\/([a-z0-9-]+)\.webp$/)?.[1];
	return (stem && PAINTED_BOUNDS[stem]) || null;
}
