import type ts from "typescript";
import { Provider } from "../util/provider";

export function getCompletionEntryDetailsFactory(provider: Provider): ts.LanguageService["getCompletionEntryDetails"] {
	const { service } = provider;

	/**
	 * Retrieve the text changes for a specific file given an array of code actions.
	 * @param file The file to get changes for
	 * @param codeActions The code actions
	 */
	function flattenChanges(file: string, codeActions: ts.CodeAction[]) {
		return codeActions
			.filter((x) => x.description.match(/^Import '.*' from module/))
			.reduce((acc, val) => acc.concat(val.changes), new Array<ts.FileTextChanges>())
			.filter((x) => x.fileName === file)
			.reduce((acc, val) => acc.concat(val.textChanges), new Array<ts.TextChange>());
	}

	return (file, pos, entry, formatOptions, source, preferences) => {
		const match = entry.match(/^(Server|Shared|Client): (\w+)$/);
		if (match && match[2] && source) {
			const result = service.getCompletionEntryDetails(file, pos, match[2], formatOptions, source, preferences);
			if (result && result.codeActions && result.codeActions.length > 0) {
				for (const textChange of flattenChanges(file, result.codeActions)) {
					textChange.newText = textChange.newText.replace(/import {(.*)}/, "import type {$1}");
				}
			}
			return result;
		}
		return service.getCompletionEntryDetails(file, pos, entry, formatOptions, source, preferences);
	};
}
