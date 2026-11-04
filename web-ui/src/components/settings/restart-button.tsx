import { RefreshCw } from "lucide-react";
import { useState } from "react";

import { Button } from "~/components/ui/button.tsx";

export function RestartButton({
	onRestart,
	label = "Restart BirdNET",
}: {
	onRestart: () => Promise<void>;
	label?: string;
}) {
	const [busy, setBusy] = useState(false);

	return (
		<Button
			type="button"
			variant="outline"
			size="default"
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
