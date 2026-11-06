import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

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
	const Icon =
		SETTINGS_SECTIONS.find((entry) => entry.tab === tab)?.icon ??
		SETTINGS_SECTIONS[0].icon;
	return (
		<div className="relative @min-[57rem]:hidden shrink-0">
			<Icon
				className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
				aria-hidden="true"
			/>
			<select
				aria-label={TABS_LABEL}
				value={tab}
				onChange={(event) => onPick(event.target.value as SettingsTab)}
				className="h-8.5 pointer-coarse:h-9 cursor-pointer appearance-none rounded-md border border-input bg-card pr-7 pl-8 font-medium pointer-coarse:text-base text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:border-focus-ring focus-visible:outline-none"
			>
				{SETTINGS_SECTIONS.map((entry) => (
					<option key={entry.tab} value={entry.tab}>
						{entry.title}
					</option>
				))}
			</select>
			<ChevronDown
				className="pointer-events-none absolute top-1/2 right-2 size-4 -translate-y-1/2 text-muted-foreground"
				aria-hidden="true"
			/>
		</div>
	);
}
