import type { ReactNode } from "react";

import { CardHeader } from "~/components/card-header.tsx";

export function EmptyNote({ children }: { children: ReactNode }) {
	return <p className="mt-page text-muted-foreground text-sm">{children}</p>;
}

export function EmptyState({
	title,
	children,
}: {
	title: string;
	children: ReactNode;
}) {
	return (
		<section aria-label={title} className="feature-card rounded-md p-4">
			<CardHeader title={title} />
			<EmptyNote>{children}</EmptyNote>
		</section>
	);
}
