import path from "path";

const cache = new Map<string, boolean>();

/**
 * Checks if the `filePath` path is a descendant of the `dirPath` path.
 * @param filePath A path to a file.
 * @param dirPath A path to a directory.
 */
export function isPathDescendantOf(filePath: string, dirPath: string) {
	if (filePath === dirPath) return true;
	const key = `${dirPath}->${path.dirname(filePath)}`;
	let result = cache.get(key);
	if (result === undefined) {
		cache.set(key, (result = !(path.relative(dirPath, filePath).substring(0, 2) === "..")));
	}
	return result;
}
