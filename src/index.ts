
/**
* Language service plugin
*/

"use strict";

import * as tssl from "typescript/lib/tsserverlibrary";
import * as path from 'path';
import { NetworkType, RojoResolver } from "./Rojo/RojoResolver";
import { isPathDescendantOf } from "./Rojo/RojoResolver/fsUtil";
import { createProxy } from "./createProxy";
import { PathTranslator } from "./Rojo/PathTranslator";
import { getConfig } from "./config";
import { Provider } from "./util/provider";
import { createConstants } from "./util/constants";

enum NetworkBoundary {
	Client = "Client",
	Server = "Server",
	Shared = "Shared",
}

export = function init(modules: { typescript: typeof tssl }) {
	const ts = modules.typescript;
	function create(info: ts.server.PluginCreateInfo) {
		const service = info.languageService;
		const serviceProxy = createProxy(service);
		const provider = new Provider(createConstants(info), serviceProxy, service, info);
		const {
			config,
			currentDirectory,
			formatOptions,
			userPreferences,
			pathTranslator,
			srcDir,
			log
		} = provider.constants;

		let rojoResolver: RojoResolver;
		if (config.useRojo) {
			const rojoConfig = RojoResolver.findRojoConfigFilePath(currentDirectory);
			if (rojoConfig) {
				log("Found rojoConfig: " + rojoConfig);
				rojoResolver = RojoResolver.fromPath(rojoConfig);
			}
		}

		/**
		 * Check if the specified file is in any of the directories.
		 * @param file The file path.
		 * @param directories The directories.
		 */
		function isInDirectories(file: string, directories: string[]): boolean {
			return directories.some(directory => isPathDescendantOf(file, path.join(currentDirectory, directory)));
		}

		/**
		 * Retrieve the boundary of a specific file.
		 * @param file The file path.
		 */
		function getNetworkBoundary(file: string): NetworkBoundary {
			if (file.length === 0) return NetworkBoundary.Shared;
			if (isInDirectories(file, config.client)) return NetworkBoundary.Client;
			if (isInDirectories(file, config.server)) return NetworkBoundary.Server;
			if (rojoResolver) {
				const rbxPath = rojoResolver.getRbxPathFromFilePath(pathTranslator.getOutputPath(file));
				log(pathTranslator.getOutputPath(file));
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
		 * Retrieve the details for the specified entry.
		 * @param file The file path.
		 * @param pos Index of the character where you want entries.
		 * @param source Source path.
		 * @param entry The entry to retrieve.
		 */
		function getEntryDetails(file: string, source: string, entry: string) {
			return service.getCompletionEntryDetails(file, 0, entry, formatOptions, source, userPreferences);
		}

		/**
		 * Check if the specified entry is an auto import and is a source file.
		 * @param file The file path.
		 * @param entry The entry to check.
		 */
		function isAutoImport(file: string, entry: ts.CompletionEntry): entry is ts.CompletionEntry & { source: string } {
			const newImport = /^Import '.*' from module/;
			const existingImport = /^Add '.*' to existing import declaration from/;
			if (entry.hasAction && entry.source && entry.source.length > 0) {
				if (isPathDescendantOf(entry.source, srcDir) && !isPathDescendantOf(entry.source, path.join(currentDirectory, "node_modules"))) {
					const actions = getEntryDetails(file, entry.source, entry.name);
					if (actions && actions.codeActions) {
						return actions.codeActions.some((value) => value.description.match(newImport) || value.description.match(existingImport));
					}
				}
			}
			return false;
		}

		/**
		 * Check if the two boundaries are able to view eachother. (Boundary <-> Boundary, Server -> Shared, Client -> Shared)
		 * @param from The boundary of the current file.
		 * @param to The boundary of the auto-complete.
		 */
		function BoundaryCanSee(from: NetworkBoundary, to: NetworkBoundary) {
			return from === to || (to === NetworkBoundary.Shared);
		}

		serviceProxy["getSemanticDiagnostics"] = (file) => {
			let orig = service.getSemanticDiagnostics(file);
			if (config.diagnosticsMode !== "off") {
				const diagnosticsCategory = ({
					["warning"]: ts.DiagnosticCategory.Warning,
					["error"]: ts.DiagnosticCategory.Error,
					["message"]: ts.DiagnosticCategory.Message
				})[config.diagnosticsMode];

				const currentBoundary = getNetworkBoundary(file);
				const sourceFile = provider.getSourceFile(file);
				sourceFile.getImports().forEach(($import) => {
					const importBoundary = getNetworkBoundary($import.absolutePath);
					log(currentBoundary + " > " + importBoundary + " > " + file + " > " + $import.absolutePath);
					if (!BoundaryCanSee(currentBoundary, importBoundary)) {
						orig.push({
							category: diagnosticsCategory,
							code: 1,
							file: sourceFile.inner,
							messageText: `Cannot import ${importBoundary} module from ${currentBoundary}`,
							start: $import.start,
							length: $import.end - $import.start
						});
					}
				});
			}
			return orig;
		}

		serviceProxy["getCompletionsAtPosition"] = (file, pos, opt) => {
			const boundary = getNetworkBoundary(file);
			let orig = service.getCompletionsAtPosition(file, pos, opt);
			if (orig) {
				const entries: ts.CompletionEntry[] = [];
				orig.entries.forEach(v => {
					if (isAutoImport(file, v)) {
						const completionBoundary = getNetworkBoundary(v.source);
						if (!BoundaryCanSee(boundary, completionBoundary)) {
							if (config.mode === "prefix") {
								v.insertText = v.name;
								v.name = completionBoundary + ": " + v.name;
							} else if (config.mode === "remove") return;
						}
					}
					entries.push(v);
				});
				orig.entries = entries;
			}
			return orig;
		}

		serviceProxy["getCompletionEntryDetails"] = (file, pos, entry, formatOptions, source, preferences) => {
			const match = entry.match(/^(Server|Shared|Client): (\w+)$/);
			if (match && match[2] && source) {
				const result = service.getCompletionEntryDetails(file, pos, match[2], formatOptions, source, preferences);
				if (result && result.codeActions && result.codeActions.length > 0) {
					const boundary = getNetworkBoundary(file);
					const completionBoundary = getNetworkBoundary(source);
					if (boundary !== completionBoundary) {
						for (const x of result.codeActions) {
							if (x.description.match(/^Import '.*' from module/)) {
								for (const change of x.changes) {
									if (change.fileName === file) {
										for (const textChange of change.textChanges) {
											textChange.newText = textChange.newText.replace(/import {(.*)}/, "import type {$1}");
										}
									}
								}
							} else if (x.description.match(/^Add '.*' to existing import declaration from/) && config.convertExistingImports) {
							out:
								for (const change of x.changes) {
									if (change.fileName === file) {
										const importDecl = change.textChanges[0];
										if (importDecl) {
											const sourceFile = provider.getSourceFile(file);
											const seek = sourceFile.seek(importDecl.span.start, "import", -1);
											if (seek) {
												x.changes.push({
													fileName: file,
													textChanges: [
														{
															newText: "import type",
															span: ts.createTextSpan(seek.start, seek.len)
														}
													]
												});
												break out;
											}
										}
									}
								}
							}
						}
					}
				}
				return result;
			}
			const result = service.getCompletionEntryDetails(file, pos, entry, formatOptions, source, preferences);
			if (result?.name === "TestController") {
				log(result.name + " : " + JSON.stringify(result));
			}
			return service.getCompletionEntryDetails(file, pos, entry, formatOptions, source, preferences);
		}

		log("Roblox-TS language extensions has loaded.");
		return serviceProxy;
	}

	return { create };
}
