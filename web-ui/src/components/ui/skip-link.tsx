import type { ReactNode } from "react";

import { cn } from "~/lib/utils.ts";

export function SkipLink({
	targetId,
	className,
	children,
}: {
	targetId: string;
	className?: string;
	children: ReactNode;
}) {
	return (
		<a
			href={`#${targetId}`}
			onClick={(event) => {
				event.preventDefault();
				document.getElementById(targetId)?.focus({ preventScroll: true });
			}}
			className={cn(
				"pointer-events-none z-60 rounded-md border border-line bg-paper-raised px-3 py-1.5 font-medium text-sm opacity-0 focus:pointer-events-auto focus:opacity-100",
				className,
			)}
		>
			{children}
		</a>
	);
}
