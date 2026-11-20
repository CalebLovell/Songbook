import { ChevronDown } from "lucide-react";
import type { ChangeEvent, ComponentProps, ReactNode } from "react";
import { createContext, useContext, useId } from "react";

import { InfoTip } from "~/components/ui/info-tip.tsx";
import { Input } from "~/components/ui/input.tsx";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group.tsx";

const FieldContext = createContext<{
	id: string;
	labelId: string;
	hintId?: string;
}>({ id: "", labelId: "" });

const ROW_LAYOUT =
	"-mx-page grid gap-x-8 gap-y-2 border-t px-page py-page sm:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] sm:items-center";

const STACKED_LAYOUT = "flex flex-col gap-1.5";

export function Field({
	label,
	hint,
	info,
	readOnly = false,
	stacked = false,
	children,
}: {
	label: string;
	hint?: ReactNode;
	info?: ReactNode;
	readOnly?: boolean;
	stacked?: boolean;
	children: ReactNode;
}) {
	const id = useId();
	const hintId = hint ? `${id}-hint` : undefined;
	const field = { id, labelId: `${id}-label`, hintId };
	const Name = readOnly ? "span" : "label";
	const hintBlock = hint ? (
		<div
			id={hintId}
			className="space-y-1 text-muted-foreground text-xs leading-relaxed"
		>
			{hint}
		</div>
	) : null;
	const name = (
		<div className="flex items-center gap-1.5">
			<Name
				id={field.labelId}
				htmlFor={readOnly ? undefined : id}
				className={`text-sm leading-6 ${stacked ? "font-semibold" : "font-medium"}`}
			>
				{label}
			</Name>
			{info ? <InfoTip label={label}>{info}</InfoTip> : null}
		</div>
	);
	const control = (
		<FieldContext.Provider value={field}>
			<div className="min-w-0">{children}</div>
		</FieldContext.Provider>
	);
	if (stacked)
		return (
			<div className={STACKED_LAYOUT}>
				{name}
				{control}
				{hintBlock}
			</div>
		);
	return (
		<div className={ROW_LAYOUT}>
			<div className="min-w-0">
				{name}
				{hintBlock}
			</div>
			{control}
		</div>
	);
}

const NO_SPINNER =
	"[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

export function FieldInput({
	unit,
	className = "",
	...props
}: ComponentProps<typeof Input> & { unit?: string }) {
	const { id, hintId } = useContext(FieldContext);
	const numeric = props.type === "number";
	const input = (
		<Input
			id={id}
			aria-describedby={hintId}
			className={`${numeric ? `tabular-nums ${NO_SPINNER}` : ""} ${unit ? (unit.length > 2 ? "pr-20" : "pr-10") : ""} ${className}`}
			{...props}
		/>
	);
	if (!unit) return input;
	return (
		<div className="relative">
			{input}
			<span
				aria-hidden="true"
				className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted-foreground text-sm"
			>
				{unit}
			</span>
		</div>
	);
}

export function FieldSelect({ children, ...props }: ComponentProps<"select">) {
	const { id, hintId } = useContext(FieldContext);
	return (
		<div className="relative">
			<select
				id={id}
				aria-describedby={hintId}
				className="h-8.5 pointer-coarse:h-9 w-full cursor-pointer appearance-none rounded-md border border-input bg-card pr-8 pl-3 pointer-coarse:text-base text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:border-focus-ring focus-visible:outline-none"
				{...props}
			>
				{children}
			</select>
			<ChevronDown
				aria-hidden="true"
				className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground"
			/>
		</div>
	);
}

export function FieldChoice<T extends string>({
	value,
	options,
	onChange,
}: {
	value: T;
	options: { value: T; label: string }[];
	onChange: (value: T) => void;
}) {
	const { labelId } = useContext(FieldContext);
	return (
		<ToggleGroup
			type="single"
			variant="outline"
			aria-labelledby={labelId || undefined}
			className="w-full"
			value={value}
			onValueChange={(next) => {
				if (next) onChange(next as T);
			}}
		>
			{options.map((option) => (
				<ToggleGroupItem
					key={option.value}
					value={option.value}
					className="flex-1"
				>
					{option.label}
				</ToggleGroupItem>
			))}
		</ToggleGroup>
	);
}

export function numberOr(
	event: ChangeEvent<HTMLInputElement>,
	fallback: number,
) {
	const parsed = event.target.valueAsNumber;
	return Number.isNaN(parsed) ? fallback : parsed;
}
