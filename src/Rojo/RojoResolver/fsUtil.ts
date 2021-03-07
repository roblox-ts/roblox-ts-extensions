import path from "path";

const cache = new Map<string, Map<string, boolean>>();
export function isPathDescendantOfNoCache(filePath: string, dirPath: string) {
	return dirPath === filePath || !path.relative(dirPath, filePath).startsWith("..");
}

/**
 * Checks if the `filePath` path is a descendant of the `dirPath` path.
 * @param filePath A path to a file.
 * @param dirPath A path to a directory.
 */
export function isPathDescendantOf(filePath: string, dirPath: string) {
	if (filePath === dirPath) return true;
	filePath = path.dirname(filePath);

	let dirCache = cache.get(dirPath);
	if (!dirCache) cache.set(dirPath, (dirCache = new Map()));

	let fileCache = dirCache.get(filePath);
	if (fileCache === undefined) dirCache.set(filePath, (fileCache = isPathDescendantOfNoCache(filePath, dirPath)));

	return fileCache;
}
