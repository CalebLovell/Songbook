import { type ReactNode, useRef, useState } from "react";

import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "~/components/ui/tooltip.tsx";

export function Hint({
	content,
	children,
	className,
}: {
	content: ReactNode;
	children: ReactNode;
	className?: string;
}) {
	const [open, setOpen] = useState(false);
	const touched = useRef(false);

	if (content == null || content === "") return children;

	return (
		<TooltipProvider>
			<Tooltip open={open} onOpenChange={setOpen}>
				<TooltipTrigger
					asChild
					onPointerDown={(event) => {
						touched.current = event.pointerType === "touch";
						if (touched.current) event.preventDefault();
					}}
					onClick={(event) => {
						if (!touched.current) return;
						event.preventDefault();
						setOpen((wasOpen) => !wasOpen);
					}}
				>
					{children}
				</TooltipTrigger>
				<TooltipContent className={className}>{content}</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}
