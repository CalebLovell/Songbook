import { Share2, Star, Trophy, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useState } from "react";
import { ShareImagePanel } from "~/components/share-image-panel.tsx";
import { Button } from "~/components/ui/button.tsx";
import { CARD_CLASS } from "~/components/ui/card.tsx";
import {
	MODAL_BACKDROP_CLASS,
	MODAL_CARD_CLASS,
	MODAL_TITLE_CLASS,
} from "~/components/ui/confirm-dialog.tsx";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group.tsx";
import { randomMixSeed } from "~/lib/collage-birds.ts";
import {
	buildShareImages,
	type ShareImageInput,
	type ShareImages,
} from "~/lib/share-image.ts";
import { cn } from "~/lib/utils.ts";

type ShareKind = keyof ShareImages;

function ShareDialogContent({ images }: { images: ShareImages }) {
	const [kind, setKind] = useState<ShareKind>("topBirds");

	return (
		<Dialog.Portal>
			<Dialog.Overlay className={MODAL_BACKDROP_CLASS}>
				<Dialog.Content
					aria-describedby={undefined}
					className={cn(CARD_CLASS, MODAL_CARD_CLASS, "max-h-full max-w-md")}
				>
					<div className="flex items-center justify-between gap-page">
						<Dialog.Title className={MODAL_TITLE_CLASS}>
							Share Summary
						</Dialog.Title>
						<Dialog.Close asChild>
							<Button
								type="button"
								variant="outline"
								size="icon"
								icon={X}
								aria-label="Close"
							/>
						</Dialog.Close>
					</div>

					{images.highlights && (
						<ToggleGroup
							type="single"
							variant="outline"
							aria-label="Share"
							className="w-full"
							value={kind}
							onValueChange={(next) => {
								if (next) setKind(next as ShareKind);
							}}
						>
							<ToggleGroupItem value="topBirds" className="flex-1 gap-1.5">
								<Trophy aria-hidden="true" />
								Top Birds
							</ToggleGroupItem>
							<ToggleGroupItem value="highlights" className="flex-1 gap-1.5">
								<Star aria-hidden="true" />
								Highlights
							</ToggleGroupItem>
						</ToggleGroup>
					)}

					<div className={kind === "topBirds" ? "contents" : "hidden"}>
						<ShareImagePanel model={images.topBirds} />
					</div>
					{images.highlights && (
						<div className={kind === "highlights" ? "contents" : "hidden"}>
							<ShareImagePanel model={images.highlights} />
						</div>
					)}
				</Dialog.Content>
			</Dialog.Overlay>
		</Dialog.Portal>
	);
}

export function ShareButton({
	input,
	shape = "pill",
	className,
}: {
	input: ShareImageInput | null;
	shape?: "pill" | "plain";
	className?: string;
}) {
	const [images, setImages] = useState<ShareImages | null>(null);

	return (
		<Dialog.Root
			open={images !== null}
			onOpenChange={(open) =>
				setImages(
					open && input ? buildShareImages(input, randomMixSeed()) : null,
				)
			}
		>
			<Dialog.Trigger asChild>
				<Button
					variant="outline"
					size={shape === "pill" ? "lg" : "default"}
					icon={Share2}
					disabled={input === null}
					className={cn(
						shape === "pill" &&
							"h-8 self-center rounded-full px-4 text-moss hover:border-hover-line hover:bg-icon-well hover:text-moss [&_svg]:size-5!",
						className,
					)}
				>
					Share
				</Button>
			</Dialog.Trigger>
			{images && <ShareDialogContent images={images} />}
		</Dialog.Root>
	);
}
