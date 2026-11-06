import { Pause, Volume2 } from "lucide-react";

import { Button } from "~/components/ui/button.tsx";
import { usePlayableAudio } from "~/lib/use-playable-audio.ts";

export const PLAY_LABEL = "Listen";

export function RecordingButton({
	audioUrl,
	iconOnly = false,
	speciesName,
	size = "xs",
	iconSize = "icon-xs",
	variant = "outline",
	labelClassName,
	className = "",
}: {
	audioUrl: string | null;
	iconOnly?: boolean;
	speciesName?: string;
	size?: "xs" | "sm" | "default";
	iconSize?: "icon-xs" | "icon-lg";
	variant?: "outline" | "default";
	labelClassName?: string;
	className?: string;
}) {
	const {
		audioRef,
		isPlaying,
		isLoading,
		togglePlay,
		onPlay,
		onPause,
		onEnded,
	} = usePlayableAudio(audioUrl);

	return (
		<>
			<Button
				variant={variant}
				size={iconOnly ? iconSize : size}
				className={`shrink-0 ${className}`}
				icon={isPlaying ? Pause : Volume2}
				loading={isLoading}
				disabled={!audioUrl}
				onClick={togglePlay}
				aria-label={
					iconOnly
						? recordingActionLabel(isPlaying, speciesName)
						: `${PLAY_LABEL} to ${speciesName ? `${speciesName} call` : "the call"}`
				}
				aria-pressed={iconOnly ? undefined : isPlaying}
			>
				{iconOnly ? null : labelClassName ? (
					<span className={labelClassName}>{PLAY_LABEL}</span>
				) : (
					PLAY_LABEL
				)}
			</Button>
			{audioUrl && (
				// biome-ignore lint/a11y/useMediaCaption: a bird call has no words to caption
				<audio
					ref={audioRef}
					preload="none"
					onPlay={onPlay}
					onPause={onPause}
					onEnded={onEnded}
				/>
			)}
		</>
	);
}

export function recordingActionLabel(
	isPlaying: boolean,
	speciesName?: string,
): string {
	return `${isPlaying ? "Pause" : "Play"} ${
		speciesName ? `${speciesName} call` : "the call"
	}`;
}
