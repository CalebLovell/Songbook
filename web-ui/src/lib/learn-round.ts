import { audioUrlFor } from "~/lib/audio.ts";

export const CHOICES_PER_QUESTION = 4;

type PoolClip = {
	date: string;
	fileName: string;
	detectedAt: string;
	confidence: number | null;
};

export type PoolSpecies = {
	comName: string;
	sciName: string;
	speciesSlug: string;
	imageUrl: string | null;
	clips: PoolClip[];
};

export type LearnChoice = {
	comName: string;
	sciName: string;
	speciesSlug: string;
	imageUrl: string | null;
	detections: number;
	firstHeard: string | null;
};

export type LearnQuestion = {
	id: string;
	audioUrl: string;
	detectedAt: string;
	confidence: number | null;
	answerSciName: string;
	choices: LearnChoice[];
};

export type LearnRound = {
	id: string;
	questions: LearnQuestion[];
	speciesInPool: number;
};

function shuffle<T>(items: T[], random: () => number): T[] {
	const copy = [...items];
	for (let index = copy.length - 1; index > 0; index -= 1) {
		const swapWith = Math.floor(random() * (index + 1));
		const held = copy[index] as T;
		copy[index] = copy[swapWith] as T;
		copy[swapWith] = held;
	}
	return copy;
}

function pick<T>(items: T[], random: () => number): T {
	return items[Math.floor(random() * items.length)] as T;
}

function toChoice(species: PoolSpecies): LearnChoice {
	return {
		comName: species.comName,
		sciName: species.sciName,
		speciesSlug: species.speciesSlug,
		imageUrl: species.imageUrl,
		detections: 0,
		firstHeard: null,
	};
}

export function buildRound(
	species: PoolSpecies[],
	random: () => number = Math.random,
): LearnRound {
	const playable = species.filter((entry) => entry.clips.length > 0);
	if (playable.length < CHOICES_PER_QUESTION) {
		return { id: "empty", questions: [], speciesInPool: playable.length };
	}

	const questions = shuffle(playable, random).map((answer, index) => {
		const clip = pick(answer.clips, random);
		const distractors = shuffle(
			playable.filter((entry) => entry.sciName !== answer.sciName),
			random,
		).slice(0, CHOICES_PER_QUESTION - 1);

		return {
			id: `${index}-${clip.date}-${clip.fileName}`,
			audioUrl: audioUrlFor(clip.date, answer.comName, clip.fileName),
			detectedAt: clip.detectedAt,
			confidence: clip.confidence,
			answerSciName: answer.sciName,
			choices: shuffle([answer, ...distractors], random).map(toChoice),
		};
	});

	return {
		id: `${Date.now().toString(36)}-${Math.floor(random() * 1e6).toString(36)}`,
		questions,
		speciesInPool: playable.length,
	};
}

export type QuestionResult = {
	attempts: number;
};

export type RoundScore = {
	firstTry: number;
	answered: number;
};

export function scoreRound(results: QuestionResult[]): RoundScore {
	return {
		firstTry: results.filter((result) => result.attempts === 1).length,
		answered: results.length,
	};
}
