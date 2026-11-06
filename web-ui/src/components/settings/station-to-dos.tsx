import { ArrowRight } from "lucide-react";

import { CardHeader } from "~/components/card-header.tsx";
import { Button } from "~/components/ui/button.tsx";
import { Card } from "~/components/ui/card.tsx";
import {
	describeToDo,
	type StationToDo,
	toDosLabel,
} from "~/lib/health-data.ts";
import { useAnnounceChange } from "~/lib/use-announce-change.ts";
import { RestartButton } from "./restart-button.tsx";
import type { SettingsTab } from "./settings-index.ts";

const HEADING_ID = "station-to-dos";

export function StationToDos({
	toDos,
	onShowSetting,
	onRestart,
}: {
	toDos: StationToDo[];
	onShowSetting: (tab: SettingsTab) => void;
	onRestart: () => Promise<void>;
}) {
	useAnnounceChange(toDos.length > 0 ? toDosLabel(toDos.length) : null);
	if (toDos.length === 0) return null;

	return (
		<Card
			as="section"
			aria-labelledby={HEADING_ID}
			className="@container overflow-hidden"
		>
			<CardHeader as="h2" titleId={HEADING_ID} title="To do" />
			<ul className="m-0 -mx-page -mb-page list-none bg-toast-error-fill p-0">
				{toDos.map((toDo) => {
					const { title, detail, action } = describeToDo(toDo);
					return (
						<li
							key={toDo.kind}
							className="flex @2xl:flex-row flex-col @2xl:items-center @2xl:justify-between gap-page border-toast-error-line border-t p-page first:border-t-0"
						>
							<div className="min-w-0">
								<h3 className="m-0 font-semibold text-base text-clay">
									{title}
								</h3>
								<p className="m-0 text-bark text-sm leading-relaxed">
									{detail}
								</p>
							</div>
							<div className="shrink-0">
								{action.kind === "restart" ? (
									<RestartButton onRestart={onRestart} />
								) : (
									<Button
										type="button"
										variant="outline"
										size="default"
										icon={ArrowRight}
										iconPosition="end"
										onClick={() => onShowSetting(action.tab)}
									>
										{action.label}
									</Button>
								)}
							</div>
						</li>
					);
				})}
			</ul>
		</Card>
	);
}
