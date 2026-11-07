import type { ComponentType, ReactNode } from "react";
import { Card } from "~/components/ui/card.tsx";

export function PageHeaderCard({
	icon: Icon,
	title,
	description,
	action,
	afterHeader,
}: {
	icon: ComponentType<{ className?: string }>;
	title: string;
	description: ReactNode;
	action?: ReactNode;
	afterHeader?: ReactNode;
}) {
	return (
		<section aria-label={title} className="space-y-page">
			<Card className="flex min-h-masthead flex-col justify-center px-4 py-3">
				<div className="flex items-start justify-between gap-3 max-[400px]:flex-col max-[400px]:gap-2">
					<div className="flex min-w-0 items-center gap-4">
						<div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-icon-well text-moss max-md:hidden">
							<Icon aria-hidden="true" className="size-5" />
						</div>
						<div className="min-w-0">
							<h1 className="font-bold text-xl leading-tight">{title}</h1>
							<p className="mt-1 text-muted-foreground text-sm **:data-[slot=count]:leading-none">
								{description}
							</p>
						</div>
					</div>
					{action}
				</div>
			</Card>

			{afterHeader}
		</section>
	);
}
