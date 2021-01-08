import path from "path";

export function isInDirectory(from: string, to: string) {
	return !path.relative(from, to).startsWith(".");
}
