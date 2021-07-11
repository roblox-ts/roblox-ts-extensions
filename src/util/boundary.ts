import path from "path";
import { NetworkType } from "../Rojo/RojoResolver";
import { isPathDescendantOf } from "../Rojo/RojoResolver/fsUtil";
import { Provider } from "./provider";

export enum NetworkBoundary {
	Client = "Client",
	Server = "Server",
	Shared = "Shared",
}

/**
 * Check if the specified file is in any of the directories.
 * @param file The file path.
 * @param directories The directories.
 */
function isInDirectories(file: string, currentDirectory: string, directories: string[]): boolean {
	return directories.some((directory) => isPathDescendantOf(file, path.join(currentDirectory, directory)));
}

function getNetworkBoundaryNoCache(provider: Provider, file: string): NetworkBoundary {
	const { currentDirectory, config, pathTranslator, rojoResolver } = provider;

	if (file.length === 0) return NetworkBoundary.Shared;
	if (isInDirectories(file, currentDirectory, config.client)) return NetworkBoundary.Client;
	if (isInDirectories(file, currentDirectory, config.server)) return NetworkBoundary.Server;
	if (config.useRojo && rojoResolver) {
		const rbxPath = rojoResolver.getRbxPathFromFilePath(pathTranslator.getOutputPath(file));
		if (rbxPath) {
			const networkType = rojoResolver.getNetworkType(rbxPath);
			if (networkType === NetworkType.Client) {
				return NetworkBoundary.Client;
			} else if (networkType === NetworkType.Server) {
				return NetworkBoundary.Server;
			}
		}
	}
	return NetworkBoundary.Shared;
}

/**
 * Retrieve the boundary of a specific file.
 * @param file The file path.
 */
export function getNetworkBoundary(provider: Provider, file: string): NetworkBoundary {
	const cache = provider.boundaryCache;

	let result = cache.get(file);
	if (!result) cache.set(file, (result = getNetworkBoundaryNoCache(provider, file)));

	return result;
}

/**
 * Check if the two boundaries are able to view eachother. (Boundary <-> Boundary, Server -> Shared, Client -> Shared)
 * @param from The boundary of the current file.
 * @param to The boundary of the auto-complete.
 */
export function boundaryCanSee(from: NetworkBoundary, to: NetworkBoundary) {
	return from === to || to === NetworkBoundary.Shared;
}
