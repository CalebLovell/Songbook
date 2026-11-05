import type { ReactNode } from "react";

import { CardHeader } from "~/components/card-header.tsx";

export type PageStatusTone = "missing" | "unavailable";

export function PageStatus({
	tone,
	title,
	heading = "h1",
	actions,
	children,
}: {
	tone: PageStatusTone;
	title: string;
	heading?: "h1" | "h2";
	actions?: ReactNode;
	children: ReactNode;
}) {
	return (
		<section aria-label={title} className="feature-card rounded-md p-4">
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
					className="mt-page flex flex-wrap items-center gap-2"
				>
					{actions}
				</div>
			) : null}
		</section>
	);
}
