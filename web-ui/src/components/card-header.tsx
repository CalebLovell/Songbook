import type { ReactNode } from "react";
import { Kicker } from "~/components/ui/kicker.tsx";

export const CARD_HEADER_CLASS =
	"-mx-page -mt-page flex min-h-11.25 items-center justify-between gap-2 border-b px-page";

export function CardHeader({
	title,
	titleId,
	as: Title = "h2",
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
		<div
			data-slot="card-header"
			className={`${CARD_HEADER_CLASS} ${className}`}
		>
			<Kicker as={Title} id={titleId} className="m-0 shrink-0">
				{title}
			</Kicker>
			{children}
		</div>
	);
}
