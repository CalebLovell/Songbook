import type { ComponentProps } from "react";

export function RowCheckbox(props: Omit<ComponentProps<"input">, "type">) {
	return (
		<input
			{...props}
			type="checkbox"
			onMouseDown={(event) => {
				if (event.shiftKey) event.preventDefault();
				props.onMouseDown?.(event);
			}}
			className="m-0 block size-row-checkbox flex-none cursor-pointer appearance-none rounded-[3px] border-[1.5px] border-[color-mix(in_oklab,var(--ink)_35%,transparent)] bg-card bg-center bg-size-[75%] bg-no-repeat transition-[background-color,border-color] duration-180 ease-[ease] checked:border-moss checked:bg-[url(data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270%200%2012%2012%27%20fill=%27none%27%20stroke=%27white%27%20stroke-width=%272%27%20stroke-linecap=%27round%27%20stroke-linejoin=%27round%27%3E%3Cpath%20d=%27M2.5%206.25%205%208.75l4.5-5.5%27/%3E%3C/svg%3E)] checked:bg-moss"
		/>
	);
}
