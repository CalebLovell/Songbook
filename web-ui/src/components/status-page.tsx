import type { ComponentType, ReactNode } from "react";

import { PageHeaderCard } from "~/components/page-header-card.tsx";
import { PageStatus, type PageStatusTone } from "~/components/page-status.tsx";
import { PageWrap } from "~/components/ui/page-wrap.tsx";

export function StatusPage({
	icon,
	section,
	sectionDescription,
	tone,
	title,
	actions,
	footer,
	children,
}: {
	icon: ComponentType<{ className?: string }>;
	section: string;
	sectionDescription: string;
	tone: PageStatusTone;
	title: string;
	actions?: ReactNode;
	footer?: ReactNode;
	children: ReactNode;
}) {
	return (
		<PageWrap className="space-y-page">
			<PageHeaderCard
				icon={icon}
				title={section}
				description={sectionDescription}
			/>
			<PageStatus
				tone={tone}
				title={title}
				heading="h2"
				actions={actions}
				footer={footer}
			>
				{children}
			</PageStatus>
		</PageWrap>
	);
}
