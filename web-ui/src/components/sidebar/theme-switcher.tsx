import { type LucideIcon, Monitor, Moon, Sun } from "lucide-react";

import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group.tsx";
import {
	setThemePreference,
	type ThemePreference,
	useThemePreference,
} from "~/lib/theme.ts";
import { cn } from "~/lib/utils.ts";

const OPTIONS: { value: ThemePreference; label: string; icon: LucideIcon }[] = [
	{ value: "light", label: "Light", icon: Sun },
	{ value: "dark", label: "Dark", icon: Moon },
	{ value: "system", label: "System", icon: Monitor },
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
			{OPTIONS.map(({ value, label, icon: Icon }) => (
				<ToggleGroupItem
					key={value}
					value={value}
					aria-label={`${label} theme`}
					className="pointer-coarse:h-9 flex-1 gap-1.5 text-xs"
				>
					<Icon aria-hidden="true" className="size-3.5" />
					{label}
				</ToggleGroupItem>
			))}
		</ToggleGroup>
	);
}
