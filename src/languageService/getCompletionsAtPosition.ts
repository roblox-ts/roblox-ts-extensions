import ts from "typescript";
import path from "path";
import { isPathDescendantOf } from "../Rojo/RojoResolver/fsUtil";
import { Provider } from "../util/provider";
import { normalizeType } from "../util/functions/normalizeType";
import { isNodeInternal } from "../util/functions/isNodeInternal";
import { BoundaryCanSee, getNetworkBoundary } from "../util/boundary";
import { findPrecedingType } from "../util/functions/findPrecedingType";
import { hasJSDocTag } from "../util/functions/hasJSDocTag";

/**
 * Create the getCompletionsAtPosition method.
 */
export function getCompletionsAtPositionFactory(provider: Provider): ts.LanguageService["getCompletionsAtPosition"] {
	const { service, srcDir, currentDirectory, config } = provider;

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

	return (file, pos, opt) => {
		const boundary = getNetworkBoundary(provider, file);
		const orig = service.getCompletionsAtPosition(file, pos, opt);
		if (orig) {
			const removedProperties = new Set<string>();
			const sourceFile = provider.getSourceFile(file);
			const typeChecker = provider.program.getTypeChecker();
			if (sourceFile) {
				const type = findPrecedingType(typeChecker, pos, sourceFile);
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
					const completionBoundary = getNetworkBoundary(provider, v.source);
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
}
