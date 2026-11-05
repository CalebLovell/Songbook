import type { ReactNode } from "react";

import { CardHeader } from "~/components/card-header.tsx";
import { Card } from "~/components/ui/card.tsx";

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
		<Card as="section" aria-label={title}>
			<CardHeader title={title} />
			<EmptyNote>{children}</EmptyNote>
		</Card>
	);
}
