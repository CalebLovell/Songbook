import { useMutation } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";

import { Button } from "~/components/ui/button.tsx";

export function RestartButton({
	onRestart,
	label = "Restart BirdNET",
	size = "default",
}: {
	onRestart: () => Promise<void>;
	label?: string;
	size?: "default" | "lg";
}) {
	const restart = useMutation({ mutationFn: () => onRestart() });
	const busy = restart.isPending;

	return (
		<Button
			type="button"
			variant="outline"
			size={size}
			icon={RefreshCw}
			loading={busy}
			title="Briefly interrupts recording while BirdNET reloads its settings"
			onClick={() => restart.mutate()}
		>
			{busy ? "Restarting…" : label}
		</Button>
	);
}
