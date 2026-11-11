import { type LucideIcon, Monitor, Moon, Sun } from "lucide-react";

import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group.tsx";
import {
	setThemePreference,
	type ThemePreference,
	useThemePreference,
} from "~/lib/theme.ts";
import { cn } from "~/lib/utils.ts";

const OPTIONS: {
	value: ThemePreference;
	label: string;
	icon: LucideIcon;
	chosen: string;
}[] = [
	{
		value: "light",
		label: "Light",
		icon: Sun,
		chosen:
			"in-data-[theme-preference=light]:bg-primary! in-data-[theme-preference=light]:text-primary-foreground!",
	},
	{
		value: "dark",
		label: "Dark",
		icon: Moon,
		chosen:
			"in-data-[theme-preference=dark]:bg-primary! in-data-[theme-preference=dark]:text-primary-foreground!",
	},
	{
		value: "system",
		label: "System",
		icon: Monitor,
		chosen:
			"in-data-[theme-preference=system]:bg-primary! in-data-[theme-preference=system]:text-primary-foreground!",
	},
];

export function ThemeSwitcher({ className }: { className?: string }) {
	const preference = useThemePreference();
	return (
		<ToggleGroup
			type="single"
			variant="outline"
			size="sm"
			aria-label="Theme"
			className={cn("w-full", className)}
			value={preference}
			onValueChange={(next) => {
				if (next) setThemePreference(next as ThemePreference);
			}}
		>
			{OPTIONS.map(({ value, label, icon: Icon, chosen }) => (
				<ToggleGroupItem
					key={value}
					value={value}
					aria-label={`${label} theme`}
					className={cn(
						"pointer-coarse:h-9 flex-1 gap-1.5 text-xs data-[state=on]:bg-card data-[state=on]:text-inherit",
						chosen,
					)}
				>
					<Icon aria-hidden="true" className="size-3.5" />
					{label}
				</ToggleGroupItem>
			))}
		</ToggleGroup>
	);
}
