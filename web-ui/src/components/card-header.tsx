import type { ReactNode } from "react";

export const CARD_HEADER_CLASS =
	"-mx-(--page-gap) -mt-(--page-gap) flex min-h-[45px] items-center justify-between gap-2 border-b px-(--page-gap)";

export function CardHeader({
	title,
	titleId,
	as: Title = "div",
	children,
	className = "",
}: {
	title: ReactNode;
	titleId?: string;
	as?: "div" | "h1" | "h2";
	children?: ReactNode;
	className?: string;
}) {
	return (
		<div className={`${CARD_HEADER_CLASS} ${className}`}>
			<Title id={titleId} className="island-kicker m-0 shrink-0">
				{title}
			</Title>
			{children}
		</div>
	);
}
