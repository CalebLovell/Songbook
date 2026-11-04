import {
	NEW_FLIGHT_SLUGS,
	NEW_SLUGS,
	PAINTED_BOUNDS,
	type PaintedBounds,
} from "~/lib/illustrations-new.ts";
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
	if (!NEW_SLUGS.has(slug)) return photos[slug] ?? null;
	const flight = pose === "flight" && NEW_FLIGHT_SLUGS.has(slug);
	return `/illustrations-new/${slug}${flight ? "-2" : ""}.png`;
}

export function isPhotoUrl(url: string): boolean {
	return url.startsWith("https://");
}

export function paintedBoundsFor(imageUrl: string): PaintedBounds | null {
	const stem = imageUrl.match(/^\/illustrations-new\/([a-z0-9-]+)\.png$/)?.[1];
	return (stem && PAINTED_BOUNDS[stem]) || null;
}
