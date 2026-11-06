import { useMutation } from "@tanstack/react-query";
import { Factory, X } from "lucide-react";
import { useState } from "react";

import { Button } from "~/components/ui/button.tsx";
import { ConfirmDialog } from "~/components/ui/confirm-dialog.tsx";
import { toast } from "~/components/ui/toaster.tsx";

export function SettingsReset({ onReset }: { onReset: () => Promise<void> }) {
	const [open, setOpen] = useState(false);
	const reset = useMutation({
		mutationFn: () => onReset(),
		onSuccess: () => setOpen(false),
		onError: () => {
			toast.error("Settings could not be reset.", {
				id: "settings-reset",
				description: "The station is unchanged.",
			});
		},
	});

	return (
		<>
			<Button
				variant="outline"
				size="lg"
				icon={Factory}
				onClick={() => setOpen(true)}
			>
				Factory defaults
			</Button>
			{open ? (
				<ConfirmDialog
					title="Restore all settings to factory defaults?"
					description="Detection, Audio input, Recording, Storage, Artwork, Highlights, and the Review queue threshold all go back to the values a fresh install writes. Any RTSP streams you have configured are cleared and the station returns to microphone input. This cannot be undone."
					cancelIcon={X}
					confirmIcon={Factory}
					confirmLabel="Restore factory defaults"
					destructive
					pending={reset.isPending}
					onCancel={() => setOpen(false)}
					onConfirm={() => reset.mutate()}
				>
					<p className="rounded-md bg-muted p-page text-muted-foreground text-xs leading-relaxed">
						Your Station card is left as it is. Its name, coordinates, and
						timezone have no default to return to, and blanking them would put
						the station at 0,0 and break geographic species filtering.
					</p>
					<p className="text-muted-foreground text-xs leading-relaxed">
						Your detections and recordings are not touched.
					</p>
				</ConfirmDialog>
			) : null}
		</>
	);
}
