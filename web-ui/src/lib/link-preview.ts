import { illustrationUrlFor, isPhotoUrl } from "~/lib/illustrations.ts";
import { pageTitle } from "~/lib/page-title.ts";

export const STATION_DESCRIPTION =
	"A record of every bird singing in the yard, heard and identified by a Raspberry Pi station.";

const PAINTING_SIZE = 800;

type PreviewImage = {
	url: string;
	alt: string;
	card: "summary" | "summary_large_image";
	width?: number;
	height?: number;
};

export function defaultPreviewImage(origin: string): PreviewImage {
	return {
		url: `${origin}/og-image.png`,
		alt: "The Songbook logo beside paintings of a goldfinch, a blue jay and a cardinal",
		card: "summary_large_image",
		width: 1200,
		height: 630,
	};
}

export function speciesPreviewImage(
	origin: string,
	comName: string,
	sciName: string,
): PreviewImage | null {
	const url = illustrationUrlFor(sciName);
	if (!url) return null;
	if (isPhotoUrl(url)) return { url, alt: comName, card: "summary" };
	return {
		url: `${origin}${url}`,
		alt: comName,
		card: "summary",
		width: PAINTING_SIZE,
		height: PAINTING_SIZE,
	};
}

export function previewImageMeta(image: PreviewImage) {
	return [
		{ property: "og:image", content: image.url },
		{ property: "og:image:alt", content: image.alt },
		...(image.width && image.height
			? [
					{ property: "og:image:width", content: String(image.width) },
					{ property: "og:image:height", content: String(image.height) },
				]
			: []),
		{ name: "twitter:card", content: image.card },
	];
}

export function previewTextMeta(title: string, description: string) {
	return [
		{ name: "description", content: description },
		{ property: "og:title", content: title },
		{ property: "og:description", content: description },
	];
}

export function pageHead(page: string, description = STATION_DESCRIPTION) {
	const title = pageTitle(page);
	return { meta: [{ title }, ...previewTextMeta(title, description)] };
}
