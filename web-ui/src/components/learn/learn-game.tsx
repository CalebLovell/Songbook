import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, RotateCcw, Trophy, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { CardHeader } from "~/components/card-header.tsx";
import { RecordingButton } from "~/components/recording-button.tsx";
import { SpeciesImage } from "~/components/species-image.tsx";
import {
	ClipMeta,
	ClipMetaSkeleton,
	SpectrogramPlayer,
	SpectrogramPlayerSkeleton,
} from "~/components/spectrogram-player.tsx";
import { Button } from "~/components/ui/button.tsx";
import { Card } from "~/components/ui/card.tsx";
import { InfoTip } from "~/components/ui/info-tip.tsx";
import { Kicker } from "~/components/ui/kicker.tsx";
import { ShellBar, ShellText } from "~/components/ui/shell.tsx";
import { announce } from "~/lib/announce.ts";
import { formatDateTime } from "~/lib/date-format.ts";
import { HIGHLIGHT_THRESHOLDS } from "~/lib/highlight-thresholds.ts";
import {
	LEARN_POOL_LABELS,
	LEARN_POOLS,
	learnPoolMeanings,
} from "~/lib/learn-pools.ts";
import {
	CHOICES_PER_QUESTION,
	type LearnChoice,
	type LearnQuestion,
	type LearnRound,
	POINTS_BY_ATTEMPT,
	pointsForAttempt,
	QUESTIONS_PER_ROUND,
	type QuestionResult,
	scoreRound,
} from "~/lib/learn-round.ts";
import { FRESH_PROGRESS, type GameProgress } from "~/lib/learn-saved-game.ts";

const QUIZ_GRID_CLASS =
	"grid grid-cols-[minmax(0,1fr)] @3xl/quiz:grid-cols-[minmax(0,1fr)_24rem] @7xl/quiz:grid-cols-[minmax(914px,1fr)_minmax(20rem,38rem)] items-start gap-page";
const GAME_CARD_CLASS = "@container/game flex min-w-0 flex-col gap-page";
const GAME_HEADER_CLASS =
	"-mx-page -mt-page flex min-h-11.25 flex-wrap items-center justify-between gap-x-2 border-b px-page py-2";
const CHOICES_CLASS =
	"grid min-w-0 @xl/game:grid-cols-2 grid-cols-1 auto-rows-fr gap-4 max-[400px]:gap-2";
const CHOICE_CLASS =
	"@container/choice flex items-center gap-4 rounded-md border px-4 py-2 text-left max-[400px]:gap-2 max-[400px]:px-2";
const CHOICE_TEXT_CLASS =
	"flex min-h-[calc(2*1.375rem+1rem)] min-w-0 flex-1 flex-col justify-center @max-[20rem]/choice:min-h-[calc(2*1.203125rem+1rem)]";
const RAIL_CLASS = "@3xl/quiz:flex hidden flex-col";
const RAIL_HEADER_CLASS =
	"-mx-page -mt-page flex min-h-11.25 items-center justify-between gap-2 border-b px-page";
const RAIL_ROW_CLASS = "flex min-h-13.75 items-center gap-3 px-page py-1.75";
const RAIL_FOOTER_CLASS =
	"-mx-page mt-auto -mb-page flex items-baseline justify-between gap-2 border-t px-page py-3";
const GAME_FOOTER_CLASS = "flex min-h-8 items-center justify-end";
const TEXT_ENTRY_SELECTOR = "input, textarea, select, [contenteditable='true']";
const CONTROL_SELECTOR = `a[href], button, [role='slider'], ${TEXT_ENTRY_SELECTOR}`;
const DIALOG_SELECTOR = "[role='dialog'], [role='alertdialog']";

function GameInfo({
	rareMax = HIGHLIGHT_THRESHOLDS.rareMax,
}: {
	rareMax?: number;
}) {
	const meanings = learnPoolMeanings(rareMax);
	return (
		<InfoTip label="Bird quiz" size="default">
			<p>
				Each round has {QUESTIONS_PER_ROUND} bird detections. Play each clip,
				then pick which bird corresponds to that audio recording.
			</p>
			<p>
				Points are gained depending on the number of guesses. The first guess
				awards {POINTS_BY_ATTEMPT[0]} points, while the second only gives{" "}
				{POINTS_BY_ATTEMPT[1]} point, and no points are gained after that.
			</p>
			<p>
				Then repeat for all {QUESTIONS_PER_ROUND} birds for your final score!
			</p>
			<p>
				On a keyboard, keys 1 to {CHOICES_PER_QUESTION} pick a bird and Enter
				moves on.
			</p>
			<p>Selection options:</p>
			<ul className="space-y-1">
				{LEARN_POOLS.map((pool) => (
					<li key={pool}>
						<strong>{LEARN_POOL_LABELS[pool]}:</strong> {meanings[pool]}
					</li>
				))}
			</ul>
		</InfoTip>
	);
}

export function LearnGameSkeleton() {
	return (
		<div className="@container/quiz">
			<div className={QUIZ_GRID_CLASS}>
				<Card
					as="section"
					aria-busy="true"
					aria-label="Bird call quiz"
					className={GAME_CARD_CLASS}
				>
					<header className={GAME_HEADER_CLASS}>
						<Kicker as="h2">Bird quiz</Kicker>
						<GameInfo />
					</header>

					<div
						aria-hidden="true"
						className="flex @3xl/quiz:hidden flex-col gap-2"
					>
						<div className="flex justify-between">
							<ShellText className="w-20 text-xs" barClassName="w-full" />
							<ShellText className="w-10 text-xs" barClassName="w-full" />
						</div>
						<div className="flex gap-1">
							{Array.from({ length: QUESTIONS_PER_ROUND }, (_, pip) => (
								<ShellBar
									// biome-ignore lint/suspicious/noArrayIndexKey: one pip per bird
									key={pip}
									className="h-1.5 flex-1 rounded-full"
								/>
							))}
						</div>
					</div>

					<SpectrogramPlayerSkeleton aside={<ClipMetaSkeleton />} />

					<div aria-hidden="true" className={CHOICES_CLASS}>
						{Array.from({ length: CHOICES_PER_QUESTION }, (_, choice) => (
							<div
								// biome-ignore lint/suspicious/noArrayIndexKey: one per choice
								key={choice}
								className={`${CHOICE_CLASS} border-line`}
							>
								<span className="w-4 shrink-0 text-center text-muted-foreground text-xs tabular-nums">
									{choice + 1}
								</span>
								<span
									className={`flex shrink-0 items-center justify-center ${THUMBNAIL_SIZES.lg}`}
								>
									<ShellBar className="size-full rounded-md" />
								</span>
								<span className={CHOICE_TEXT_CLASS}>
									<ShellText
										className="font-medium @max-[20rem]/choice:text-sm leading-snug"
										barClassName={choice % 2 ? "w-28" : "w-36"}
									/>
									<ShellText className="text-xs" barClassName="w-24" />
								</span>
								<span className="size-4 shrink-0" />
							</div>
						))}
					</div>

					<div className={GAME_FOOTER_CLASS}>
						<Button
							size="default"
							icon={ArrowRight}
							iconPosition="end"
							disabled
						>
							Next bird
						</Button>
					</div>
				</Card>

				<Card
					as="aside"
					aria-busy="true"
					aria-label="This round"
					className={RAIL_CLASS}
				>
					<div className={RAIL_HEADER_CLASS}>
						<Kicker as="h2">This round</Kicker>
					</div>
					<ol aria-hidden="true" className="-mx-page divide-y">
						{Array.from({ length: QUESTIONS_PER_ROUND }, (_, position) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: one row per bird
							<li key={position} className={RAIL_ROW_CLASS}>
								<ShellBar className="size-5 shrink-0 rounded-full" />
								<ShellText className="flex-1 text-sm" barClassName="w-full" />
							</li>
						))}
					</ol>
					<div className={RAIL_FOOTER_CLASS}>
						<span className="text-muted-foreground text-sm">Score</span>
						<ShellText
							className="w-18 font-semibold text-xl leading-none"
							barClassName="right-0 left-auto w-full"
						/>
					</div>
				</Card>
			</div>
		</div>
	);
}

export function LearnGameEmpty({ message }: { message: string }) {
	return (
		<div className="@container/quiz">
			<div className={QUIZ_GRID_CLASS}>
				<Card
					as="section"
					aria-label="Bird call quiz"
					className={GAME_CARD_CLASS}
				>
					<header className={GAME_HEADER_CLASS}>
						<Kicker as="h2">Bird quiz</Kicker>
					</header>
					<p className="text-muted-foreground text-sm">{message}</p>
				</Card>

				<Card as="aside" aria-label="This round" className={RAIL_CLASS}>
					<div className={RAIL_HEADER_CLASS}>
						<Kicker as="h2">This round</Kicker>
					</div>
					<p className="mt-page text-muted-foreground text-sm">{message}</p>
				</Card>
			</div>
		</div>
	);
}

export function LearnGame({
	round,
	rareMax,
	initialProgress = FRESH_PROGRESS,
	onProgressChange,
	onPlayAgain,
	isLoadingNextRound,
	isPaused = false,
	focusClipOnStart = false,
}: {
	round: LearnRound;
	rareMax: number;
	initialProgress?: GameProgress;
	onProgressChange?: (progress: GameProgress) => void;
	onPlayAgain: () => void;
	isLoadingNextRound: boolean;
	isPaused?: boolean;
	focusClipOnStart?: boolean;
}) {
	const [progress, setProgress] = useState(initialProgress);
	const nextButton = useRef<HTMLButtonElement>(null);
	const playButton = useRef<HTMLButtonElement>(null);
	const focusAfterRender = useRef<"next" | "clip" | null>(
		focusClipOnStart ? "clip" : null,
	);
	const justFinished = useRef(false);
	const { index, wrongGuesses, isSolved, results, isFinished } = progress;

	useEffect(() => {
		onProgressChange?.(progress);
	}, [progress, onProgressChange]);

	useEffect(() => {
		const target = focusAfterRender.current;
		focusAfterRender.current = null;
		if (target === "next") nextButton.current?.focus();
		if (target === "clip") playButton.current?.focus();
	});

	const question = round.questions[index];
	const runningScore = scoreRound(results);

	const guess = useCallback(
		(choice: LearnChoice) => {
			if (!question || isSolved || wrongGuesses.includes(choice.sciName))
				return;

			if (choice.sciName === question.answerSciName) {
				const points = pointsForAttempt(wrongGuesses.length + 1);
				announce(
					`Correct: ${choice.comName}. ${points} ${points === 1 ? "point" : "points"}.`,
				);
				focusAfterRender.current = "next";
				setProgress((previous) => ({
					...previous,
					results: [
						...previous.results,
						{ attempts: previous.wrongGuesses.length + 1 },
					],
					isSolved: true,
				}));
				return;
			}

			announce(`Not the ${choice.comName}. Try again.`);
			setProgress((previous) => ({
				...previous,
				wrongGuesses: [...previous.wrongGuesses, choice.sciName],
			}));
		},
		[question, isSolved, wrongGuesses],
	);

	const advance = useCallback(() => {
		if (!isSolved) return;
		if (index + 1 >= round.questions.length) {
			justFinished.current = true;
			setProgress((previous) => ({ ...previous, isFinished: true }));
			return;
		}
		announce(`Bird ${index + 2} of ${round.questions.length}.`);
		focusAfterRender.current = "clip";
		setProgress((previous) => ({
			...previous,
			index: previous.index + 1,
			wrongGuesses: [],
			isSolved: false,
		}));
	}, [isSolved, index, round.questions.length]);

	useEffect(() => {
		if (isFinished || isPaused) return;

		function onKeyDown(event: KeyboardEvent) {
			if (event.metaKey || event.ctrlKey || event.altKey) return;
			const target = event.target instanceof Element ? event.target : null;
			if (target?.closest(DIALOG_SELECTOR)) return;
			if (event.key === "Enter") {
				if (!target?.closest(CONTROL_SELECTOR)) advance();
				return;
			}
			if (target?.closest(TEXT_ENTRY_SELECTOR)) return;
			const choice = question?.choices[Number(event.key) - 1];
			if (choice) guess(choice);
		}

		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [question, guess, advance, isFinished, isPaused]);

	if (!question) return null;

	if (isFinished) {
		return (
			<RoundSummary
				questions={round.questions}
				results={results}
				onPlayAgain={onPlayAgain}
				isLoadingNextRound={isLoadingNextRound}
				takeFocus={justFinished.current}
			/>
		);
	}

	return (
		<div className="@container/quiz">
			<div className={QUIZ_GRID_CLASS}>
				<Card
					as="section"
					aria-label="Bird call quiz"
					className={GAME_CARD_CLASS}
				>
					<header className={GAME_HEADER_CLASS}>
						<Kicker as="h2">Bird quiz</Kicker>
						<GameInfo rareMax={rareMax} />
					</header>

					<div className="flex @3xl/quiz:hidden flex-col gap-2">
						<div className="flex justify-between text-muted-foreground text-xs tabular-nums">
							<span>
								Bird {index + 1} of {round.questions.length}
							</span>
							<span>{runningScore.score} pts</span>
						</div>
						<ProgressTrack
							total={round.questions.length}
							results={results}
							current={index}
						/>
					</div>

					<fieldset className="min-w-0">
						<legend className="sr-only">Listening prompt</legend>
						<SpectrogramPlayer
							key={question.id}
							audioUrl={question.audioUrl}
							playButtonRef={playButton}
							aside={
								<ClipMeta
									heardAt={formatDateTime(question.detectedAt)}
									confidence={question.confidence}
								/>
							}
						/>
					</fieldset>

					<fieldset className={CHOICES_CLASS}>
						<legend className="sr-only">Bird choices</legend>
						{question.choices.map((choice, choiceIndex) => (
							<ChoiceButton
								key={choice.sciName}
								choice={choice}
								shortcut={choiceIndex + 1}
								state={
									isSolved && choice.sciName === question.answerSciName
										? "correct"
										: wrongGuesses.includes(choice.sciName)
											? "wrong"
											: isSolved
												? "muted"
												: "open"
								}
								onSelect={() => guess(choice)}
							/>
						))}
					</fieldset>

					<div className={GAME_FOOTER_CLASS}>
						{index + 1 >= round.questions.length ? (
							<Button
								ref={nextButton}
								size="default"
								icon={Trophy}
								onClick={advance}
								disabled={!isSolved}
							>
								See your score
							</Button>
						) : (
							<Button
								ref={nextButton}
								size="default"
								icon={ArrowRight}
								iconPosition="end"
								onClick={advance}
								disabled={!isSolved}
							>
								Next bird
							</Button>
						)}
					</div>
				</Card>

				<RoundRail
					questions={round.questions}
					results={results}
					current={index}
					score={runningScore.score}
					maxScore={round.questions.length * POINTS_BY_ATTEMPT[0]}
				/>
			</div>
		</div>
	);
}

function RoundRail({
	questions,
	results,
	current,
	score,
	maxScore,
}: {
	questions: LearnQuestion[];
	results: QuestionResult[];
	current: number;
	score: number;
	maxScore: number;
}) {
	return (
		<Card as="aside" aria-label="This round" className={RAIL_CLASS}>
			<div className={RAIL_HEADER_CLASS}>
				<Kicker as="h2">This round</Kicker>
			</div>

			<ol className="-mx-page divide-y">
				{questions.map((question, position) => {
					const result = results[position];
					const answer = question.choices.find(
						(choice) => choice.sciName === question.answerSciName,
					);
					const isCurrent = position === current && !result;

					return (
						<li
							key={question.id}
							aria-current={isCurrent ? "step" : undefined}
							className={`${RAIL_ROW_CLASS} ${isCurrent ? "bg-row-selected" : ""}`}
						>
							<RailDot
								position={position}
								attempts={result?.attempts ?? null}
							/>
							{result && answer ? (
								<AnsweredRailRow
									answer={answer}
									attempts={result.attempts}
									question={question}
								/>
							) : isCurrent ? (
								<>
									<span
										aria-hidden="true"
										className={`flex shrink-0 items-center justify-center rounded-md border border-line border-dashed text-muted-foreground text-sm ${THUMBNAIL_SIZES.md}`}
									>
										?
									</span>
									<span className="text-sm italic">Mystery bird</span>
								</>
							) : (
								<span className="text-muted-foreground text-sm">—</span>
							)}
						</li>
					);
				})}
			</ol>

			<div className={RAIL_FOOTER_CLASS}>
				<span className="text-muted-foreground text-sm">Score</span>
				<span className="font-semibold text-xl tabular-nums leading-none">
					{score}
					<span className="ml-1 font-normal text-muted-foreground text-sm">
						of {maxScore} pts
					</span>
				</span>
			</div>
		</Card>
	);
}

function AnsweredRailRow({
	answer,
	attempts,
	question,
}: {
	answer: LearnChoice;
	attempts: number;
	question: LearnQuestion;
}) {
	return (
		<>
			<ChoiceThumbnail choice={answer} size="md" />

			<div className="min-w-0 flex-1">
				<Link
					to="/birds/$comName"
					params={{ comName: answer.speciesSlug }}
					className="block min-w-0 max-w-fit truncate font-medium text-sm no-underline hover:underline"
				>
					{answer.comName}
				</Link>
				<div className="truncate text-bark text-xs italic">
					{answer.sciName}
				</div>
			</div>

			<div className="shrink-0 text-right">
				<div className="text-sm tabular-nums">
					+{pointsForAttempt(attempts)}
				</div>
				<div className="text-muted-foreground text-xs tabular-nums">
					{attemptLabel(attempts)}
				</div>
			</div>

			<RecordingButton
				audioUrl={question.audioUrl}
				speciesName={answer.comName}
				iconOnly
			/>
		</>
	);
}

function RailDot({
	position,
	attempts,
}: {
	position: number;
	attempts: number | null;
}) {
	const color =
		attempts === null
			? "bg-muted text-muted-foreground"
			: attempts === 1
				? "bg-[color-mix(in_oklab,var(--moss)_12%,var(--paper-raised))] font-semibold text-moss"
				: "bg-[color-mix(in_oklab,var(--clay)_10%,var(--paper-raised))] font-semibold text-clay";
	const label = String(position + 1);

	return (
		<span
			className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] tabular-nums ${color}`}
		>
			<span style={{ transform: `translateY(${digitNudge(label)}px)` }}>
				{label}
			</span>
		</span>
	);
}

function digitNudge(label: string) {
	const top = /[68]/.test(label) ? 9 : 6;
	const bottom = /[34579]/.test(label) ? 2 : 0;
	return (top - bottom) / 2 - 3.75;
}

function ProgressTrack({
	total,
	results,
	current,
}: {
	total: number;
	results: QuestionResult[];
	current: number;
}) {
	return (
		<div className="flex gap-1">
			{Array.from({ length: total }, (_, position) => {
				const result = results[position];
				const background = result
					? result.attempts === 1
						? "var(--moss)"
						: "var(--sand)"
					: position === current
						? "var(--track)"
						: "transparent";

				return (
					<div
						// biome-ignore lint/suspicious/noArrayIndexKey: pips are positional
						key={position}
						className="h-1.5 flex-1 rounded-full border border-line"
						style={{ background }}
					/>
				);
			})}
		</div>
	);
}

type ChoiceState = "open" | "correct" | "wrong" | "muted";

const CHOICE_STYLES: Record<ChoiceState, string> = {
	open: "border-line bg-paper-raised hover:border-hover-line hover:bg-meadow",
	correct:
		"cursor-default border-moss bg-[color-mix(in_oklab,var(--moss)_12%,var(--paper-raised))]",
	wrong:
		"cursor-default border-clay bg-[color-mix(in_oklab,var(--clay)_10%,var(--paper-raised))] opacity-80",
	muted: "cursor-default border-line bg-paper-raised opacity-50",
};

function ChoiceButton({
	choice,
	shortcut,
	state,
	onSelect,
}: {
	choice: LearnChoice;
	shortcut: number;
	state: ChoiceState;
	onSelect: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onSelect}
			aria-disabled={state === "open" ? undefined : true}
			className={`${CHOICE_CLASS} ${CHOICE_STYLES[state]}`}
		>
			<span className="w-4 shrink-0 text-center text-muted-foreground text-xs tabular-nums">
				{shortcut}
			</span>
			<ChoiceThumbnail choice={choice} size="lg" />
			<span className={CHOICE_TEXT_CLASS}>
				<span className="line-clamp-2 font-medium @max-[20rem]/choice:text-sm leading-snug">
					{choice.comName}
				</span>
				<span className="block truncate text-bark text-xs italic">
					{choice.sciName}
				</span>
			</span>
			<span className="size-4 shrink-0">
				{state === "correct" ? (
					<>
						<Check aria-hidden="true" className="size-4 text-moss" />
						<span className="sr-only">Correct</span>
					</>
				) : state === "wrong" ? (
					<>
						<X aria-hidden="true" className="size-4 text-clay" />
						<span className="sr-only">Not this one</span>
					</>
				) : null}
			</span>
		</button>
	);
}

const THUMBNAIL_SIZES = {
	sm: "h-6 w-8",
	md: "size-10",
	lg: "h-20 w-24 @max-[20rem]/choice:h-12 @max-[20rem]/choice:w-14 max-[400px]:h-10 max-[400px]:w-13",
} as const;

const GLYPH_SIZES: Record<keyof typeof THUMBNAIL_SIZES, string> = {
	sm: "size-4",
	md: "size-5",
	lg: "size-10 @max-[20rem]/choice:size-6 max-[400px]:size-5",
};

function ChoiceThumbnail({
	choice,
	size = "md",
}: {
	choice: LearnChoice;
	size?: keyof typeof THUMBNAIL_SIZES;
}) {
	return (
		<span
			className={`flex shrink-0 items-center justify-center overflow-hidden ${THUMBNAIL_SIZES[size]}`}
		>
			<SpeciesImage
				imageUrl={choice.imageUrl}
				alt=""
				glyphClassName={GLYPH_SIZES[size]}
			/>
		</span>
	);
}

function attemptLabel(attempts: number): string {
	if (attempts === 1) return "First try";
	if (attempts === 2) return "Second guess";
	return `${attempts} guesses`;
}

function RoundSummary({
	questions,
	results,
	onPlayAgain,
	isLoadingNextRound,
	takeFocus,
}: {
	questions: LearnQuestion[];
	results: QuestionResult[];
	onPlayAgain: () => void;
	isLoadingNextRound: boolean;
	takeFocus: boolean;
}) {
	const score = scoreRound(results);
	const card = useRef<HTMLElement>(null);
	const [shouldTakeFocus] = useState(takeFocus);
	useEffect(() => {
		if (shouldTakeFocus) card.current?.focus();
	}, [shouldTakeFocus]);

	return (
		<Card
			as="section"
			ref={card}
			tabIndex={-1}
			aria-label="Round results"
			className="@container flex animate-rise-in flex-col gap-page outline-none focus-visible:outline-none"
		>
			<CardHeader title="Round complete">
				<span className="text-sm tabular-nums">
					<strong className="font-semibold">{score.score}</strong> of{" "}
					<strong className="font-semibold">{score.maxScore}</strong> pts
				</span>
			</CardHeader>

			<ol className="-mx-page -mt-page">
				{questions.map((question, position) => {
					const result = results[position];
					const answer = question.choices.find(
						(choice) => choice.sciName === question.answerSciName,
					);
					if (!result || !answer) return null;

					return (
						<li
							key={question.id}
							className="flex items-center gap-4 px-page py-1.75 odd:bg-meadow max-[400px]:gap-2"
						>
							<ChoiceThumbnail choice={answer} />
							<div className="min-w-0 flex-1">
								<Link
									to="/birds/$comName"
									params={{ comName: answer.speciesSlug }}
									className="block max-w-fit truncate font-medium no-underline hover:underline"
								>
									{answer.comName}
								</Link>
								<div className="text-muted-foreground text-xs">
									{attemptLabel(result.attempts)} ·{" "}
									{formatDateTime(question.detectedAt)}
								</div>
							</div>
							<span className="shrink-0 text-sm tabular-nums">
								+{pointsForAttempt(result.attempts)}
							</span>
							<RecordingButton
								audioUrl={question.audioUrl}
								speciesName={answer.comName}
								labelClassName="@min-[26rem]:inline hidden"
								className="@min-[26rem]:w-auto w-6 @min-[26rem]:px-2.5 px-0"
							/>
						</li>
					);
				})}
			</ol>

			<div className="-mx-page -mt-page -mb-page flex items-center justify-between gap-4 border-t p-page max-[400px]:gap-2">
				<span className="min-w-0 text-sm tabular-nums">
					You named <strong className="font-semibold">{score.firstTry}</strong>{" "}
					of <strong className="font-semibold">{score.answered}</strong> species
					on the first try.
				</span>
				<Button
					size="default"
					icon={RotateCcw}
					onClick={onPlayAgain}
					disabled={isLoadingNextRound}
				>
					{isLoadingNextRound ? "Dealing a new round…" : "Play again"}
				</Button>
			</div>
		</Card>
	);
}
