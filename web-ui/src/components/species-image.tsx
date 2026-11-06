import { Bird } from "lucide-react";
import { createContext, useContext, useState } from "react";

import {
	type ArtworkPreference,
	DEFAULT_ARTWORK_PREFERENCE,
	isPhotoUrl,
	paintedBoundsFor,
	photoInPlaceOfPainting,
} from "~/lib/illustrations.ts";
import { cn } from "~/lib/utils.ts";

export const ArtworkPreferenceContext = createContext<ArtworkPreference>(
	DEFAULT_ARTWORK_PREFERENCE,
);

export function SpeciesImage({
	imageUrl: requestedUrl,
	alt,
	glyphClassName,
	title,
	loading,
	cropToPainting = false,
}: {
	imageUrl: string | null;
	alt: string;
	glyphClassName: string;
	title?: string;
	loading?: "lazy" | "eager";
	cropToPainting?: boolean;
}) {
	const [failedUrl, setFailedUrl] = useState<string | null>(null);
	const preference = useContext(ArtworkPreferenceContext);
	const preferredUrl =
		requestedUrl && preference === "photos"
			? photoInPlaceOfPainting(requestedUrl)
			: requestedUrl;
	const imageUrl = preferredUrl === failedUrl ? requestedUrl : preferredUrl;
	const isPhoto = imageUrl ? isPhotoUrl(imageUrl) : false;
	if (imageUrl && isPhoto && failedUrl !== imageUrl) {
		return (
			<img
				ref={(img) => {
					if (img?.complete && img.naturalWidth === 0) setFailedUrl(imageUrl);
				}}
				src={imageUrl}
				alt={alt}
				title={title}
				loading={loading}
				referrerPolicy="no-referrer"
				className="aspect-square h-full w-auto max-w-full rounded-md object-cover"
				onError={() => setFailedUrl(imageUrl)}
			/>
		);
	}
	const bounds =
		imageUrl && !isPhoto && cropToPainting ? paintedBoundsFor(imageUrl) : null;
	if (imageUrl && bounds) {
		return (
			<svg
				viewBox={bounds.join(" ")}
				role={alt ? "img" : undefined}
				aria-label={alt || undefined}
				aria-hidden={alt ? undefined : true}
				className="h-full w-auto max-w-full"
			>
				{title ? <title>{title}</title> : null}
				<image href={imageUrl} width={480} height={480} />
			</svg>
		);
	}
	if (imageUrl && !isPhoto) {
		return (
			<img
				src={imageUrl}
				alt={alt}
				title={title}
				loading={loading}
				className="size-full object-contain"
			/>
		);
	}
	return (
		<Bird
			role={alt ? "img" : undefined}
			aria-label={alt || undefined}
			aria-hidden={alt ? undefined : true}
			className={cn("shrink-0 text-muted-foreground", glyphClassName)}
		/>
	);
}
