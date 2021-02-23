import ts from "typescript";
import { getNetworkBoundary } from "../util/boundary";
import { Provider } from "../util/provider";

export function getCompletionEntryDetailsFactory(provider: Provider): ts.LanguageService["getCompletionEntryDetails"] {
	const { service } = provider;
	return (file, pos, entry, formatOptions, source, preferences) => {
		const match = entry.match(/^(Server|Shared|Client): (\w+)$/);
		if (match && match[2] && source) {
			const result = service.getCompletionEntryDetails(file, pos, match[2], formatOptions, source, preferences);
			if (result && result.codeActions && result.codeActions.length > 0) {
				const boundary = getNetworkBoundary(provider, file);
				const completionBoundary = getNetworkBoundary(provider, source);
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
}
