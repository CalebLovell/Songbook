import type { ComponentType, ReactNode } from "react";

import { PageHeaderCard } from "~/components/page-header-card.tsx";
import { PageStatus, type PageStatusTone } from "~/components/page-status.tsx";

export function StatusPage({
	icon,
	section,
	sectionDescription,
	tone,
	title,
	actions,
	children,
}: {
	icon: ComponentType<{ className?: string }>;
	section: string;
	sectionDescription: string;
	tone: PageStatusTone;
	title: string;
	actions?: ReactNode;
	children: ReactNode;
}) {
	return (
		<div className="page-wrap space-y-(--page-gap) py-4">
			<PageHeaderCard
				icon={icon}
				title={section}
				description={sectionDescription}
			/>
			<PageStatus tone={tone} title={title} heading="h2" actions={actions}>
				{children}
			</PageStatus>
		</div>
	);
}
