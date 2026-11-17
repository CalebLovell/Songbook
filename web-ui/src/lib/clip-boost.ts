import { createContext, useContext } from "react";

export const CLIP_BOOST_GAIN = 3;

export const BoostQuietRecordingsContext = createContext(true);

export function useBoostQuietRecordings() {
	return useContext(BoostQuietRecordingsContext);
}

type ClipRoute = { source: MediaElementAudioSourceNode; gain: GainNode };

let context: AudioContext | null = null;
let limiter: DynamicsCompressorNode | null = null;
const routes = new WeakMap<HTMLAudioElement, ClipRoute>();

function sharedGraph() {
	if (!context) {
		context = new AudioContext();
		limiter = context.createDynamicsCompressor();
		limiter.threshold.value = -6;
		limiter.knee.value = 6;
		limiter.ratio.value = 20;
		limiter.attack.value = 0.002;
		limiter.release.value = 0.2;
		limiter.connect(context.destination);
	}
	return { context, limiter: limiter as DynamicsCompressorNode };
}

// Runs inside the tap: iOS Safari only starts an AudioContext from a gesture.
// An element routed once can't be unrouted, so turning the boost off bypasses the limiter at unity gain.
export function applyClipBoost(audio: HTMLAudioElement | null, boost: boolean) {
	if (!audio || typeof AudioContext === "undefined") return;
	let route = routes.get(audio);
	if (!route && !boost) return;
	const graph = sharedGraph();
	if (!route) {
		const source = graph.context.createMediaElementSource(audio);
		const gain = graph.context.createGain();
		source.connect(gain);
		route = { source, gain };
		routes.set(audio, route);
	}
	route.gain.disconnect();
	route.gain.connect(boost ? graph.limiter : graph.context.destination);
	route.gain.gain.value = boost ? CLIP_BOOST_GAIN : 1;
	if (graph.context.state !== "running") graph.context.resume().catch(() => {});
}
