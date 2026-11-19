import type { ReactNode } from "react";
import { Kicker } from "~/components/ui/kicker.tsx";

export const CARD_HEADER_CLASS =
	"-mx-page -mt-page flex min-h-11.25 items-center justify-between gap-2 border-b px-page";

export const CARD_HEADER_LINK_CLASS =
	"inline-flex items-center gap-1 text-xs no-underline hover:underline";
export const CARD_HEADER_TEXT_BUTTON_CLASS = `${CARD_HEADER_LINK_CLASS} cursor-pointer text-moss decoration-moss/45 underline-offset-2 hover:text-ink`;

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
