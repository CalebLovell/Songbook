import { cva, type VariantProps } from "class-variance-authority";
import { Loader2, type LucideIcon } from "lucide-react";
import { Slot } from "radix-ui";
import * as React from "react";

import { cn } from "~/lib/utils.ts";

const buttonVariants = cva(
	"inline-flex shrink-0 items-center justify-center rounded-md font-medium whitespace-nowrap transition-all disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0",
	{
		variants: {
			variant: {
				default: "bg-primary text-primary-foreground hover:bg-primary/90",
				destructive:
					"bg-destructive text-white hover:bg-destructive/90 focus-visible:outline-destructive",
				outline: "border bg-card hover:bg-accent hover:text-accent-foreground",
				secondary:
					"bg-secondary text-secondary-foreground hover:bg-secondary/80",
				ghost: "hover:bg-accent hover:text-accent-foreground",
				link: "text-primary underline-offset-4 hover:underline",
			},
			size: {
				xs: "h-6 gap-1.5 px-2.5 text-[11px] [&_svg:not([class*='size-'])]:size-3",
				sm: "h-7 gap-1.5 px-3 text-xs [&_svg:not([class*='size-'])]:size-3.5",
				default:
					"h-8 gap-2 px-3.5 text-sm [&_svg:not([class*='size-'])]:size-4",
				lg: "h-8.5 gap-2 pointer-coarse:h-9 px-5 text-sm [&_svg:not([class*='size-'])]:size-4",
				"icon-xs": "size-6 text-[11px] [&_svg:not([class*='size-'])]:size-3",
				"icon-sm": "size-7 text-xs [&_svg:not([class*='size-'])]:size-3.5",
				icon: "size-8 text-sm [&_svg:not([class*='size-'])]:size-4",
				"icon-lg":
					"size-8 pointer-coarse:size-9 text-sm [&_svg:not([class*='size-'])]:size-4",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "xs",
		},
	},
);

type ButtonProps = React.ComponentProps<"button"> &
	VariantProps<typeof buttonVariants> & {
		asChild?: boolean;
		icon?: LucideIcon;
		iconPosition?: "start" | "end";
		loading?: boolean;
	};

function Button({
	className,
	variant = "default",
	size = "xs",
	asChild = false,
	icon: Icon,
	iconPosition = "start",
	loading = false,
	disabled,
	children,
	...props
}: ButtonProps) {
	const Comp = asChild ? Slot.Root : "button";

	const glyph = loading ? (
		<Loader2 aria-hidden="true" className="animate-spin" />
	) : Icon ? (
		<Icon aria-hidden="true" />
	) : null;

	return (
		<Comp
			data-slot="button"
			data-variant={variant}
			data-size={size}
			className={cn(buttonVariants({ variant, size, className }))}
			disabled={asChild ? undefined : disabled || loading}
			{...props}
		>
			{asChild
				? withGlyph(children, glyph, iconPosition)
				: order(children, glyph, iconPosition)}
		</Comp>
	);
}

function order(
	children: React.ReactNode,
	glyph: React.ReactNode,
	iconPosition: "start" | "end",
) {
	if (!glyph) return children;
	return iconPosition === "end" ? (
		<>
			{children}
			{glyph}
		</>
	) : (
		<>
			{glyph}
			{children}
		</>
	);
}

function withGlyph(
	children: React.ReactNode,
	glyph: React.ReactNode,
	iconPosition: "start" | "end",
) {
	if (!glyph) return children;

	const child = React.Children.only(children) as React.ReactElement<{
		children?: React.ReactNode;
	}>;

	return React.cloneElement(
		child,
		undefined,
		order(child.props.children, glyph, iconPosition),
	);
}

export { Button, buttonVariants };
