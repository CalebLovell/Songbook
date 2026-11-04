import { Bird } from "lucide-react";
import { useState } from "react";

import { isPhotoUrl, paintedBoundsFor } from "~/lib/illustrations.ts";
import { cn } from "~/lib/utils.ts";

export function SpeciesImage({
	imageUrl,
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
				<image href={imageUrl} width={800} height={800} />
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
