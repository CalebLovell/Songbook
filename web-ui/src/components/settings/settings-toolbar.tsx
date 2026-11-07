import type { ReactNode } from "react";

import { IconSelect } from "~/components/ui/icon-select.tsx";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group.tsx";
import { SETTINGS_SECTIONS, type SettingsTab } from "./settings-index.ts";

const TABS_LABEL = "Settings section";

export function SettingsToolbar({
	tab,
	onTabChange,
	actions,
}: {
	tab: SettingsTab;
	onTabChange: (next: SettingsTab) => void;
	actions: ReactNode;
}) {
	return (
		<div className="@container">
			<div className="flex flex-wrap items-center justify-between gap-page">
				<div className="@max-[57rem]:hidden">
					<ToggleGroup
						type="single"
						variant="outline"
						aria-label={TABS_LABEL}
						value={tab}
						onValueChange={(value) => {
							if (value) onTabChange(value as SettingsTab);
						}}
					>
						{SETTINGS_SECTIONS.map(({ tab: value, title, icon: Icon }) => (
							<ToggleGroupItem key={value} value={value}>
								<Icon
									className="@max-[74rem]:hidden size-4"
									aria-hidden="true"
								/>
								{title}
							</ToggleGroupItem>
						))}
					</ToggleGroup>
				</div>
				<SettingsTabSelect tab={tab} onPick={onTabChange} />
				<div className="flex flex-wrap items-center justify-end gap-page">
					{actions}
				</div>
			</div>
		</div>
	);
}

function SettingsTabSelect({
	tab,
	onPick,
}: {
	tab: SettingsTab;
	onPick: (next: SettingsTab) => void;
}) {
	return (
		<IconSelect
			icon={
				SETTINGS_SECTIONS.find((entry) => entry.tab === tab)?.icon ??
				SETTINGS_SECTIONS[0].icon
			}
			label={TABS_LABEL}
			value={tab}
			onChange={onPick}
			className="@min-[57rem]:hidden"
			options={SETTINGS_SECTIONS.map((entry) => ({
				value: entry.tab,
				label: entry.title,
			}))}
		/>
	);
}
