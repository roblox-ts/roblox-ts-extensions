/**
 * Language service plugin
 */

"use strict";

import {} from "ts-expose-internals";
import * as ts from "typescript";
import * as path from "path";
import { NetworkType, RojoResolver } from "./Rojo/RojoResolver";
import { isPathDescendantOf } from "./Rojo/RojoResolver/fsUtil";
import { createProxy } from "./createProxy";
import { Provider } from "./util/provider";
import { createConstants, Diagnostics } from "./util/constants";
import { PluginCreateInfo } from "./types";
import { isNodeInternal } from "./util/functions/isNodeInternal";
import { normalizeType } from "./util/functions/normalizeType";
import { findPrecedingType } from "./util/functions/findPrecedingType";

enum NetworkBoundary {
	Client = "Client",
	Server = "Server",
	Shared = "Shared",
}

export = function init(modules: { typescript: typeof ts }) {
	const ts = modules.typescript;
	let provider: Provider;
	function create(info: PluginCreateInfo) {
		const service = info.languageService;
		const serviceProxy = createProxy(service);
		provider = new Provider(createConstants(info), serviceProxy, service, info);
		const { config, currentDirectory, pathTranslator, srcDir, log } = provider.constants;

		let rojoResolver: RojoResolver;
		const rojoConfig = RojoResolver.findRojoConfigFilePath(currentDirectory);
		if (rojoConfig) {
			log("Found rojoConfig: " + rojoConfig);
			rojoResolver = RojoResolver.fromPath(rojoConfig);
		}

		/**
		 * Check if the specified file is in any of the directories.
		 * @param file The file path.
		 * @param directories The directories.
		 */
		function isInDirectories(file: string, directories: string[]): boolean {
			return directories.some((directory) => isPathDescendantOf(file, path.join(currentDirectory, directory)));
		}

		/**
		 * Retrieve the boundary of a specific file.
		 * @param file The file path.
		 */
		function getNetworkBoundary(file: string): NetworkBoundary {
			if (file.length === 0) return NetworkBoundary.Shared;
			if (isInDirectories(file, config.client)) return NetworkBoundary.Client;
			if (isInDirectories(file, config.server)) return NetworkBoundary.Server;
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
		 * Check if the specified entry is an auto import and is a source file.
		 * @param file The file path.
		 * @param pos The position.
		 * @param entry The entry to check.
		 */
		function isAutoImport(entry: ts.CompletionEntry): entry is ts.CompletionEntry & { source: string } {
			if (entry.hasAction && entry.source) {
				if (
					isPathDescendantOf(entry.source, srcDir) &&
					!isPathDescendantOf(entry.source, path.join(currentDirectory, "node_modules"))
				) {
					return true;
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
			return from === to || to === NetworkBoundary.Shared;
		}

		/**
		 * Check if a node has a specific jsdoc tag.
		 * @param node The node to check
		 * @param name The name of the jsdoc tag
		 */
		function hasJSDocTag(node: ts.Node, name: string) {
			return ts.getAllJSDocTags(node, (tag): tag is ts.JSDocTag => tag.tagName.text === name).length > 0;
		}

		/**
		 * Check if a list of declarations for internal or hidden variants.
		 * @param declarations The declarations to check
		 */
		function isRemovable(declarations: ts.Declaration[] | undefined): [isInternal: boolean, isHidden: boolean] {
			if (!declarations) return [false, false];
			return [
				declarations.some((declaration) => isNodeInternal(provider, declaration)),
				declarations.some((declaration) => hasJSDocTag(declaration, "hidden")),
			];
		}

		serviceProxy["getSemanticDiagnostics"] = (file) => {
			const orig = service.getSemanticDiagnostics(file);
			if (config.diagnosticsMode !== "off") {
				const diagnosticsCategory = {
					["warning"]: ts.DiagnosticCategory.Warning,
					["error"]: ts.DiagnosticCategory.Error,
					["message"]: ts.DiagnosticCategory.Message,
				}[config.diagnosticsMode];

				const currentBoundary = getNetworkBoundary(file);
				const sourceFile = provider.getSourceFile(file);
				sourceFile
					.getImports()
					.filter((x) => !x.typeOnly)
					.forEach(($import) => {
						const importBoundary = getNetworkBoundary($import.absolutePath);
						if (!BoundaryCanSee(currentBoundary, importBoundary)) {
							orig.push({
								category: diagnosticsCategory,
								code: Diagnostics.CrossBoundaryImport,
								file: sourceFile.inner,
								messageText: `Cannot import ${importBoundary} module from ${currentBoundary}`,
								start: $import.start,
								length: $import.end - $import.start,
							});
						}
					});
			}

			return orig;
		};

		serviceProxy["getCodeFixesAtPosition"] = (file, start, end, codes, formatOptions, preferences) => {
			let orig = service.getCodeFixesAtPosition(file, start, end, codes, formatOptions, preferences);

			const semanticDiagnostics = serviceProxy
				.getSemanticDiagnostics(file)
				.filter((x) => Diagnostics[x.code] !== undefined);
			semanticDiagnostics.forEach((diag) => {
				if (diag.start !== undefined && diag.length !== undefined) {
					if (start >= diag.start && end <= diag.start + diag.length) {
						const sourceFile = provider.getSourceFile(file);
						const $import = sourceFile.getImport(diag.start);
						if ($import) {
							orig = [
								{
									fixName: "crossBoundaryImport",
									fixAllDescription: "Make all cross-boundary imports type only",
									description: "Make cross-boundary import type only.",
									changes: [
										{
											fileName: file,
											textChanges: [
												{
													newText: "import type",
													span: ts.createTextSpan($import.start, 6),
												},
											],
										},
									],
								},
								...orig,
							];
						}
					}
				}
			});

			return orig;
		};

		serviceProxy["getCompletionsAtPosition"] = (file, pos, opt) => {
			const boundary = getNetworkBoundary(file);
			const orig = service.getCompletionsAtPosition(file, pos, opt);
			if (orig) {
				const removedProperties = new Set<string>();
				const sourceFile = provider.getSourceFile(file);
				const typeChecker = provider.program.getTypeChecker();
				if (sourceFile) {
					const type = findPrecedingType(typeChecker, pos, sourceFile.inner);
					if (type) {
						normalizeType(type).forEach((subtype) => {
							for (const x of subtype.getApparentProperties()) {
								const [isInternal, isHidden] = isRemovable(x.getDeclarations());
								if (x.name === "prototype") {
									if (!x.declarations || isInternal) {
										removedProperties.add("prototype");
									}
								} else if (isHidden) {
									removedProperties.add(x.name);
								}
							}
						});
					}
				}
				const entries: ts.CompletionEntry[] = [];
				orig.entries.forEach((v) => {
					const modifiers = v.kindModifiers?.split(",") ?? [];
					if (modifiers.includes("deprecated") && config.hideDeprecated) return;
					if (isAutoImport(v)) {
						const completionBoundary = getNetworkBoundary(v.source);
						if (!BoundaryCanSee(boundary, completionBoundary)) {
							if (config.mode === "prefix") {
								v.insertText = v.name;
								v.name = completionBoundary + ": " + v.name;
							} else if (config.mode === "remove") return;
						}
					} else if (removedProperties.has(v.name)) return;
					entries.push(v);
				});
				orig.entries = entries;
			}
			return orig;
		};

		serviceProxy["getCompletionEntryDetails"] = (file, pos, entry, formatOptions, source, preferences) => {
			const match = entry.match(/^(Server|Shared|Client): (\w+)$/);
			if (match && match[2] && source) {
				const result = service.getCompletionEntryDetails(
					file,
					pos,
					match[2],
					formatOptions,
					source,
					preferences,
				);
				if (result && result.codeActions && result.codeActions.length > 0) {
					const boundary = getNetworkBoundary(file);
					const completionBoundary = getNetworkBoundary(source);
					if (boundary !== completionBoundary) {
						for (const x of result.codeActions) {
							if (x.description.match(/^Import '.*' from module/)) {
								for (const change of x.changes) {
									if (change.fileName === file) {
										for (const textChange of change.textChanges) {
											textChange.newText = textChange.newText.replace(
												/import {(.*)}/,
												"import type {$1}",
											);
										}
									}
								}
							}
						}
					}
				}
				return result;
			}
			return service.getCompletionEntryDetails(file, pos, entry, formatOptions, source, preferences);
		};

		// Thank you, typescript, for not giving a proper api for registering a codefix.
		for (const x in Diagnostics) {
			const diag = Diagnostics[x];
			if (typeof diag === "number") {
				(ts as any).codefix.registerCodeFix({
					errorCodes: [diag],
					getCodeActions: () => undefined,
				});
			}
		}

		// If roblox-ts-extensions fails, this code will fallback to the original method.
		// If this isn't a roblox-ts project, this code will fallback to the original method.
		for (const key in serviceProxy) {
			const method = (serviceProxy as any)[key];
			const originalMethod = (service as any)[key];
			if (method && originalMethod) {
				(serviceProxy as any)[key] = function () {
					if (!provider.isRbxtsProject()) return originalMethod.apply(service, arguments);
					try {
						return method.apply(service, arguments);
					} catch (err) {
						if (err instanceof Error) {
							console.error(`[roblox-ts error] ${key}`, `${err.stack ?? err.message}`);
						}
						return originalMethod.apply(service, arguments);
					}
				};
			}
		}

		// Add any unimplemented default methods.
		serviceProxy.addProxyMethods();

		log("roblox-ts language extensions has loaded.");
		return serviceProxy;
	}

	function onConfigurationChanged(config: any) {
		if (!provider) throw "NO PROVIDER";
		if (provider) {
			console.log(config);
			Object.assign(provider.constants.config, config);
		}
	}

	return { create, onConfigurationChanged };
};
