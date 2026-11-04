import { parseSearchWith, stringifySearchWith } from "@tanstack/react-router";

// No parser argument: with one, a numeric-looking string is quoted in the URL
// (?date=%222026%22). Search schemas coerce such values back to strings.
export const stringifySearch = stringifySearchWith(JSON.stringify);
export const parseSearch = parseSearchWith(JSON.parse);
