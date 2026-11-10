// navigator.clipboard is undefined on a plain-HTTP LAN address, so the deprecated
// execCommand path is the only one that works there. The field goes inside `container`
// so a dialog's focus trap doesn't pull focus out of it.
export async function copyText(
	text: string,
	container: HTMLElement,
): Promise<boolean> {
	if (navigator.clipboard?.writeText) {
		try {
			await navigator.clipboard.writeText(text);
			return true;
		} catch {}
	}

	const focused = document.activeElement;
	const field = document.createElement("textarea");
	field.value = text;
	field.setAttribute("readonly", "");
	field.style.position = "fixed";
	field.style.opacity = "0";
	container.append(field);
	field.select();
	const copied = document.execCommand("copy");
	field.remove();
	if (focused instanceof HTMLElement) focused.focus();
	return copied;
}
