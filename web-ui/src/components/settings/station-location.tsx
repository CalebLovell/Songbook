import { Check, Crosshair, X } from "lucide-react";
import { useState } from "react";

import { Button } from "~/components/ui/button.tsx";
import {
	MODAL_ACTIONS_CLASS,
	MODAL_BACKDROP_CLASS,
	MODAL_CARD_CLASS,
	MODAL_TITLE_CLASS,
} from "~/components/ui/confirm-dialog.tsx";

const COORDINATE_PLACES = 4;

function round(value: number) {
	return Number(value.toFixed(COORDINATE_PLACES));
}

export type Coordinates = { latitude: number; longitude: number };

type State =
	| { kind: "idle" }
	| { kind: "locating" }
	| { kind: "found"; coordinates: Coordinates; accuracy: number | null }
	| { kind: "error"; message: string };

function unavailableReason(): string | null {
	if (typeof window === "undefined") return null;
	if (!window.isSecureContext)
		return "Your browser only shares location over a secure connection. Reach this station over HTTPS or at localhost, or enter the coordinates by hand.";
	if (!("geolocation" in navigator))
		return "This browser cannot report a location. Enter the coordinates by hand.";
	return null;
}

function describe(error: GeolocationPositionError): string {
	if (error.code === error.PERMISSION_DENIED)
		return "Your browser refused to share a location. Allow location access for this site and try again.";
	if (error.code === error.POSITION_UNAVAILABLE)
		return "No location could be determined. Check that location services are switched on.";
	return "Finding your location took too long. Try again.";
}

export function StationLocation({
	current,
	onApply,
}: {
	current: Coordinates;
	onApply: (coordinates: Coordinates) => void;
}) {
	const [state, setState] = useState<State>({ kind: "idle" });

	function locate() {
		const unavailable = unavailableReason();
		if (unavailable) {
			setState({ kind: "error", message: unavailable });
			return;
		}
		setState({ kind: "locating" });
		navigator.geolocation.getCurrentPosition(
			(position) =>
				setState({
					kind: "found",
					coordinates: {
						latitude: round(position.coords.latitude),
						longitude: round(position.coords.longitude),
					},
					accuracy: Number.isFinite(position.coords.accuracy)
						? Math.round(position.coords.accuracy)
						: null,
				}),
			(error) => setState({ kind: "error", message: describe(error) }),
			{ enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
		);
	}

	const open = state.kind === "found" || state.kind === "error";
	return (
		<>
			<Button
				type="button"
				variant="outline"
				size="default"
				icon={Crosshair}
				loading={state.kind === "locating"}
				onClick={locate}
			>
				{state.kind === "locating" ? "Locating…" : "Use my location"}
			</Button>
			{open ? (
				<div
					role="dialog"
					aria-modal="true"
					aria-labelledby="station-location-title"
					className={MODAL_BACKDROP_CLASS}
				>
					<div className={`${MODAL_CARD_CLASS} max-w-md`}>
						<h2 id="station-location-title" className={MODAL_TITLE_CLASS}>
							{state.kind === "found"
								? "Use this location?"
								: "Location unavailable"}
						</h2>
						{state.kind === "found" ? (
							<>
								<dl className="tabular-data grid grid-cols-2 gap-(--page-gap) rounded-md bg-muted p-(--page-gap) text-sm">
									<div>
										<dt className="island-kicker">Latitude</dt>
										<dd className="mt-1 font-semibold">
											{state.coordinates.latitude}
										</dd>
									</div>
									<div>
										<dt className="island-kicker">Longitude</dt>
										<dd className="mt-1 font-semibold">
											{state.coordinates.longitude}
										</dd>
									</div>
								</dl>
								<p className="text-muted-foreground text-sm leading-relaxed">
									This replaces {current.latitude}, {current.longitude} in the
									form. Nothing is written to the station until you save the
									Station card.
								</p>
								{state.accuracy !== null ? (
									<p className="text-muted-foreground text-xs leading-relaxed">
										Your browser puts this within about {state.accuracy} m. It
										reports the location of the device you are reading this on,
										which may not be where the microphone is.
									</p>
								) : null}
							</>
						) : (
							<p className="text-muted-foreground text-sm leading-relaxed">
								{state.message}
							</p>
						)}
						<div className={MODAL_ACTIONS_CLASS}>
							<Button
								type="button"
								size="default"
								variant="outline"
								icon={X}
								onClick={() => setState({ kind: "idle" })}
							>
								{state.kind === "found" ? "Cancel" : "Close"}
							</Button>
							{state.kind === "found" ? (
								<Button
									type="button"
									size="default"
									icon={Check}
									onClick={() => {
										onApply(state.coordinates);
										setState({ kind: "idle" });
									}}
								>
									Use these coordinates
								</Button>
							) : null}
						</div>
					</div>
				</div>
			) : null}
		</>
	);
}
