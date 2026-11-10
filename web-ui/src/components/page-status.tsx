import type { ReactNode } from "react";

import { CardHeader } from "~/components/card-header.tsx";
import { Card } from "~/components/ui/card.tsx";

export type PageStatusTone = "missing" | "unavailable";

export function PageStatus({
	tone,
	title,
	heading = "h1",
	actions,
	footer,
	children,
}: {
	tone: PageStatusTone;
	title: string;
	heading?: "h1" | "h2";
	actions?: ReactNode;
	footer?: ReactNode;
	children: ReactNode;
}) {
	return (
		<Card as="section" aria-label={title}>
			<CardHeader
				as={heading}
				title={
					tone === "unavailable" ? (
						<span className="text-destructive">{title}</span>
					) : (
						title
					)
				}
			/>
			<div className="mt-page max-w-2xl text-muted-foreground text-sm leading-relaxed">
				{children}
			</div>
			{actions ? (
				<div
					data-testid="page-status-actions"
					className="mt-page flex flex-wrap items-center gap-page"
				>
					{actions}
				</div>
			) : null}
			{footer ? (
				<div className="-mx-page mt-page -mb-page border-t px-page py-3">
					{footer}
				</div>
			) : null}
		</Card>
	);
}
