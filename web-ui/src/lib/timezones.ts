const RENAMED: Record<string, string> = {
	"Africa/Asmera": "Africa/Asmara",
	"America/Buenos_Aires": "America/Argentina/Buenos_Aires",
	"America/Catamarca": "America/Argentina/Catamarca",
	"America/Coral_Harbour": "America/Atikokan",
	"America/Cordoba": "America/Argentina/Cordoba",
	"America/Godthab": "America/Nuuk",
	"America/Indianapolis": "America/Indiana/Indianapolis",
	"America/Jujuy": "America/Argentina/Jujuy",
	"America/Louisville": "America/Kentucky/Louisville",
	"America/Mendoza": "America/Argentina/Mendoza",
	"Asia/Calcutta": "Asia/Kolkata",
	"Asia/Katmandu": "Asia/Kathmandu",
	"Asia/Rangoon": "Asia/Yangon",
	"Asia/Saigon": "Asia/Ho_Chi_Minh",
	"Atlantic/Faeroe": "Atlantic/Faroe",
	"Europe/Kiev": "Europe/Kyiv",
	"Pacific/Enderbury": "Pacific/Kanton",
	"Pacific/Ponape": "Pacific/Pohnpei",
	"Pacific/Truk": "Pacific/Chuuk",
};

export function modernTimezone(name: string): string {
	return RENAMED[name] ?? name;
}

export function timezoneOptions(): string[] {
	return [
		...new Set([
			"UTC",
			...Intl.supportedValuesOf("timeZone").map(modernTimezone),
		]),
	].sort();
}

export function isKnownTimezone(name: string): boolean {
	if (!/^[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+)*$/.test(name)) return false;
	try {
		new Intl.DateTimeFormat("en-US", { timeZone: name });
		return true;
	} catch {
		return false;
	}
}
