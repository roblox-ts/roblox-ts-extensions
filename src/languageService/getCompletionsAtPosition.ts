import ts from "typescript";
import { isPathDescendantOf } from "../Rojo/RojoResolver/fsUtil";
import { Provider } from "../util/provider";
import { normalizeType } from "../util/functions/normalizeType";
import { isNodeInternal } from "../util/functions/isNodeInternal";
import { BoundaryCanSee, getNetworkBoundary } from "../util/boundary";
import { findPrecedingType } from "../util/functions/findPrecedingType";
import { getWithDefault } from "../util/functions/getOrDefault";

interface ModifiedEntry {
	remove?: boolean;
	source?: string;
}

/**
 * Create the getCompletionsAtPosition method.
 */
export function getCompletionsAtPositionFactory(provider: Provider): ts.LanguageService["getCompletionsAtPosition"] {
	const { service, srcDir, config } = provider;
	const host = provider.info.languageServiceHost;
	const importSuggestionsCache = host.getImportSuggestionsCache && host.getImportSuggestionsCache();

	/**
	 * Check if the specified entry is an auto import and is a source file.
	 * @param file The file path.
	 * @param pos The position.
	 * @param entry The entry to check.
	 */
	function isAutoImport(entry: ts.CompletionEntry): entry is ts.CompletionEntry & { source: string } {
		if (entry.hasAction && entry.source) {
			if (isPathDescendantOf(entry.source, srcDir)) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Determines what actions should be done on this symbol.
	 * @param symbol The symbol to check
	 * @param inScope Is this symbol in scope, or in a field expression?
	 */
	function getModifications(symbol: ts.Symbol, isAccessExpression = false, source?: string) {
		const modifiedEntry: ModifiedEntry = {
			remove: false,
			source,
		};

		const declarations = symbol.getDeclarations() ?? [];
		const isInternal = declarations.some((declaration) => isNodeInternal(provider, declaration));
		const tags = declarations.reduce(
			(acc, declaration) => acc.concat(ts.getJSDocTags(declaration).map((x) => x.tagName.text)),
			new Array<string>(),
		);

		// If this symbol has the @hidden tag
		if (tags.includes("hidden")) modifiedEntry.remove = true;

		if (isAccessExpression) {
			// If this is Function.prototype or class.prototype
			if (symbol.name === "prototype" && (isInternal || !symbol.declarations)) modifiedEntry.remove = true;
		}

		return modifiedEntry;
	}

	/**
	 * Retrieve the symbols that can be imported.
	 * @param sourceFile The source file
	 * @returns An array of symbols that can be imported
	 */
	function getAutoImportSuggestions(sourceFile: ts.SourceFile): Array<ts.Symbol> {
		const typeChecker = provider.program.getTypeChecker();
		const cached = importSuggestionsCache?.get(
			sourceFile.fileName,
			typeChecker,
			host.getProjectVersion && host.getProjectVersion(),
		);
		if (cached) return cached.map((x) => x.symbol);
		const symbols = new Array<ts.Symbol>();
		ts.codefix.forEachExternalModuleToImportFrom(
			provider.program,
			provider.info.languageServiceHost,
			sourceFile,
			true,
			false,
			(moduleSymbol) => typeChecker.getExportsOfModule(moduleSymbol).forEach((symbol) => symbols.push(symbol)),
		);
		return symbols;
	}

	/**
	 * Get the SymbolFlags based on a precedingToken.
	 * @param precedingToken The precedingToken
	 * @returns The flags for the precedingToken
	 */
	function getScopeFlags(precedingToken: ts.Node): ts.SymbolFlags {
		const typeOnly = precedingToken ? ts.isValidTypeOnlyAliasUseSite(precedingToken) : false;
		return (
			(typeOnly ? ts.SymbolFlags.Type : ts.SymbolFlags.Value) | ts.SymbolFlags.Namespace | ts.SymbolFlags.Alias
		);
	}

	return (file, pos, opt) => {
		const boundary = getNetworkBoundary(provider, file);
		const orig = service.getCompletionsAtPosition(file, pos, opt);
		if (orig) {
			const modifiedEntries = new Map<string, Array<ModifiedEntry>>();
			const sourceFile = provider.getSourceFile(file);
			const typeChecker = provider.program.getTypeChecker();
			if (sourceFile) {
				const token = ts.findPrecedingToken(pos, sourceFile) ?? sourceFile.endOfFileToken;
				const type = findPrecedingType(typeChecker, token);
				if (type) {
					normalizeType(type).forEach((subtype) => {
						for (const symbol of subtype.getApparentProperties()) {
							getWithDefault(modifiedEntries, symbol.name, []).push(getModifications(symbol, true));
						}
					});
				} else {
					typeChecker.getSymbolsInScope(token, getScopeFlags(token)).forEach((symbol) => {
						getWithDefault(modifiedEntries, symbol.name, []).push(getModifications(symbol));
					});
					getAutoImportSuggestions(sourceFile).forEach((symbol) => {
						if (!symbol.parent) return;
						getWithDefault(modifiedEntries, symbol.name, []).push(
							getModifications(symbol, false, ts.stripQuotes(symbol.parent.name)),
						);
					});
				}
			}
			const entries: ts.CompletionEntry[] = [];
			orig.entries.forEach((v) => {
				const modifiers = v.kindModifiers?.split(",") ?? [];
				const modification = modifiedEntries.get(v.name)?.find((entry) => entry.source === v.source) ?? {};
				if (modifiers.includes("deprecated") && config.hideDeprecated) return;
				if (modification.remove) return;
				if (isAutoImport(v)) {
					const completionBoundary = getNetworkBoundary(provider, v.source);
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
	};
}
