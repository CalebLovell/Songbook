import { Check, Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "~/components/ui/button.tsx";
import { toast } from "~/components/ui/toaster.tsx";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "~/components/ui/tooltip.tsx";
import { cn } from "~/lib/utils.ts";

const COPIED_FEEDBACK_MS = 2_000;

// navigator.clipboard is undefined on a plain-HTTP LAN address, so the deprecated
// execCommand path is the only one that works there.
async function copyText(text: string): Promise<boolean> {
	if (navigator.clipboard?.writeText) {
		try {
			await navigator.clipboard.writeText(text);
			return true;
		} catch {}
	}

	const field = document.createElement("textarea");
	field.value = text;
	field.setAttribute("readonly", "");
	field.style.position = "fixed";
	field.style.opacity = "0";
	document.body.append(field);
	field.select();
	const copied = document.execCommand("copy");
	field.remove();
	return copied;
}

export type ShareState = {
	share: () => Promise<void>;
	isReady: boolean;
	isBusy: boolean;
	justCopied: boolean;
};

export function useShare({
	subject,
	load,
}: {
	subject: string | null;
	load: () => Promise<string>;
}): ShareState {
	const [isBusy, setIsBusy] = useState(false);
	const [justCopied, setJustCopied] = useState(false);

	const loadRef = useRef(load);
	useEffect(() => {
		loadRef.current = load;
	});

	const pending = useRef<{ subject: string; text: Promise<string> } | null>(
		null,
	);
	useEffect(() => {
		if (subject === null || pending.current?.subject === subject) return;
		const text = loadRef.current();
		text.catch(() => {});
		pending.current = { subject, text };
	}, [subject]);

	useEffect(() => {
		if (!justCopied) return;
		const timer = setTimeout(() => setJustCopied(false), COPIED_FEEDBACK_MS);
		return () => clearTimeout(timer);
	}, [justCopied]);

	async function share() {
		const current = pending.current;
		if (subject === null || current?.subject !== subject) return;

		setIsBusy(true);
		try {
			const text = await current.text;
			if (!(await copyText(text))) {
				toast.error("Copying was blocked by the browser.");
				return;
			}
			setJustCopied(true);
			toast.success("Copied to clipboard");
		} catch {
			toast.error("Could not build the summary. Try again in a moment.");
		} finally {
			setIsBusy(false);
		}
	}

	return { share, isReady: subject !== null, isBusy, justCopied };
}

export function ShareButton({
	state,
	shape = "pill",
	className,
}: {
	state: ShareState;
	shape?: "pill" | "plain";
	className?: string;
}) {
	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						variant="outline"
						size={shape === "pill" ? "lg" : "default"}
						icon={state.justCopied ? Check : Share2}
						loading={state.isBusy}
						disabled={!state.isReady}
						onClick={state.share}
						className={cn(
							shape === "pill" &&
								"h-8 self-center rounded-full px-4 text-moss transition-colors duration-[180ms] hover:border-hover-line hover:bg-icon-well hover:text-moss [&_svg]:size-5!",
							className,
						)}
					>
						Share
					</Button>
				</TooltipTrigger>
				<TooltipContent>Copy summary</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}
