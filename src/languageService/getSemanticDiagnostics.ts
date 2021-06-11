import type ts from "typescript";
import { boundaryCanSee, getNetworkBoundary } from "../util/boundary";
import { DIAGNOSTIC_CODE } from "../util/constants";
import { getImports } from "../util/imports";
import { Provider } from "../util/provider";

interface ClarifiedDiagnostic {
	regex: RegExp;
	func: (diagnostic: ts.Diagnostic, match: RegExpExecArray) => void;
}

const CLARIFIED_DIAGNOSTICS: Array<ClarifiedDiagnostic> = [
	{
		regex: /Property '_nominal_(.*)' is missing in type '(.*)' but required in type '(.*)'./,
		func: (diagnostic, match) => {
			diagnostic.messageText = `Type '${match[2]}' is not assignable to nominal type '${match[1]}'`;
		},
	},
	{
		regex: /Type '(.*?)' is missing the following properties from type '(.*?)': .*?_nominal_(\2)/,
		func: (diagnostic, match) => {
			diagnostic.messageText = `Type '${match[1]}' is not assignable to nominal type '${match[2]}'`;
		},
	},
];

export function getSemanticDiagnosticsFactory(provider: Provider): ts.LanguageService["getSemanticDiagnostics"] {
	const { service, config, ts } = provider;
	return (file) => {
		const orig = service.getSemanticDiagnostics(file);
		if (config.diagnosticsMode !== "off") {
			const diagnosticsCategory = {
				["warning"]: ts.DiagnosticCategory.Warning,
				["error"]: ts.DiagnosticCategory.Error,
				["message"]: ts.DiagnosticCategory.Message,
			}[config.diagnosticsMode];

			const currentBoundary = getNetworkBoundary(provider, file);
			const sourceFile = provider.getSourceFile(file);
			getImports(provider, sourceFile)
				.filter((x) => !x.typeOnly)
				.forEach(($import) => {
					const importBoundary = getNetworkBoundary(provider, $import.absolutePath);
					if (!boundaryCanSee(currentBoundary, importBoundary)) {
						orig.push({
							category: diagnosticsCategory,
							code: DIAGNOSTIC_CODE,
							file: sourceFile,
							messageText: `Cannot import ${importBoundary} module from ${currentBoundary}`,
							start: $import.start,
							length: $import.end - $import.start,
						});
					}
				});
		}

		orig.forEach((diagnostic) => {
			if (typeof diagnostic.messageText === "string") {
				for (const clarifiedDiagnostic of CLARIFIED_DIAGNOSTICS) {
					const match = clarifiedDiagnostic.regex.exec(diagnostic.messageText);
					if (match) {
						clarifiedDiagnostic.func(diagnostic, match);
						break;
					}
				}
			}
		});

		return orig;
	};
}
