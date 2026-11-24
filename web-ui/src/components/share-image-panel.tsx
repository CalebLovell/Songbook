import { Check, Copy, Download, RotateCw, Share2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "~/components/ui/button.tsx";
import { MODAL_ACTIONS_CLASS } from "~/components/ui/confirm-dialog.tsx";
import { ShellBar } from "~/components/ui/shell.tsx";
import { toast } from "~/components/ui/toaster.tsx";
import type { ShareImageModel } from "~/lib/share-image.ts";
import { renderShareImage } from "~/lib/share-image-canvas.ts";

const COPIED_FEEDBACK_MS = 2_000;

type Rendered =
	| { status: "drawing" }
	| { status: "ready"; file: File; url: string }
	| { status: "failed" };

function canCopyImage(): boolean {
	return (
		typeof ClipboardItem !== "undefined" &&
		typeof navigator.clipboard?.write === "function"
	);
}

function canShareFile(file: File): boolean {
	return (
		typeof navigator.canShare === "function" &&
		window.matchMedia("(pointer: coarse)").matches &&
		navigator.canShare({ files: [file] })
	);
}

export function ShareImagePanel({ model }: { model: ShareImageModel }) {
	const [attempt, setAttempt] = useState(0);
	return (
		<ImagePanel
			key={attempt}
			model={model}
			onRetry={() => setAttempt((n) => n + 1)}
		/>
	);
}

function ImagePanel({
	model,
	onRetry,
}: {
	model: ShareImageModel;
	onRetry: () => void;
}) {
	const [rendered, setRendered] = useState<Rendered>({ status: "drawing" });
	const [justCopied, setJustCopied] = useState(false);
	const [offerCopy] = useState(canCopyImage);

	useEffect(() => {
		let url: string | null = null;
		let live = true;
		renderShareImage(model).then(
			(blob) => {
				if (!live) return;
				url = URL.createObjectURL(blob);
				const file = new File([blob], model.fileName, { type: "image/png" });
				setRendered({ status: "ready", file, url });
			},
			() => live && setRendered({ status: "failed" }),
		);
		return () => {
			live = false;
			if (url) URL.revokeObjectURL(url);
		};
	}, [model]);

	useEffect(() => {
		if (!justCopied) return;
		const timer = setTimeout(() => setJustCopied(false), COPIED_FEEDBACK_MS);
		return () => clearTimeout(timer);
	}, [justCopied]);

	const ready = rendered.status === "ready" ? rendered : null;
	const offerShare = ready !== null && canShareFile(ready.file);

	function download() {
		if (!ready) return;
		const link = document.createElement("a");
		link.href = ready.url;
		link.download = ready.file.name;
		link.click();
	}

	async function copy() {
		if (!ready) return;
		try {
			await navigator.clipboard.write([
				new ClipboardItem({ "image/png": ready.file }),
			]);
			setJustCopied(true);
			toast.success("Image copied to clipboard");
		} catch {
			toast.error("Copying was blocked by the browser.");
		}
	}

	async function openShareSheet() {
		if (!ready) return;
		try {
			await navigator.share({ files: [ready.file] });
		} catch (error) {
			if (error instanceof DOMException && error.name === "AbortError") return;
			toast.error("Could not open the share sheet.");
		}
	}

	return (
		<>
			<div
				data-testid="share-image-preview"
				aria-busy={rendered.status === "drawing"}
				className="relative mx-auto aspect-9/16 h-[min(58vh,30rem)] max-w-full overflow-hidden rounded-md border border-line bg-meadow"
			>
				{ready && (
					<img
						src={ready.url}
						alt={model.alt}
						className="size-full object-contain"
					/>
				)}
				{rendered.status === "drawing" && (
					<ShellBar className="absolute inset-0 rounded-none" />
				)}
				{rendered.status === "failed" && (
					<span className="absolute inset-0 flex items-center justify-center p-page text-center text-muted-foreground text-sm">
						Could not draw the image.
					</span>
				)}
			</div>

			<div className={MODAL_ACTIONS_CLASS}>
				{rendered.status === "failed" ? (
					<Button
						type="button"
						size="default"
						icon={RotateCw}
						onClick={onRetry}
					>
						Try again
					</Button>
				) : (
					<>
						{offerCopy && (
							<Button
								type="button"
								size="default"
								variant="outline"
								icon={justCopied ? Check : Copy}
								loading={!ready}
								onClick={copy}
								className="min-w-26"
							>
								{justCopied ? "Copied" : "Copy"}
							</Button>
						)}
						<Button
							type="button"
							size="default"
							variant={offerShare ? "outline" : "default"}
							icon={Download}
							loading={!ready}
							onClick={download}
						>
							Download
						</Button>
						{offerShare && (
							<Button
								type="button"
								size="default"
								icon={Share2}
								onClick={openShareSheet}
							>
								Share
							</Button>
						)}
					</>
				)}
			</div>
		</>
	);
}
