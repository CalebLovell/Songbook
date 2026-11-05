import { RefreshCw } from "lucide-react";
import { useState } from "react";

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
	const [busy, setBusy] = useState(false);

	return (
		<Button
			type="button"
			variant="outline"
			size={size}
			icon={RefreshCw}
			loading={busy}
			title="Briefly interrupts recording while BirdNET reloads its settings"
			onClick={async () => {
				setBusy(true);
				try {
					await onRestart();
				} finally {
					setBusy(false);
				}
			}}
		>
			{busy ? "Restarting…" : label}
		</Button>
	);
}
