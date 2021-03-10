import ts from "typescript";
import { BoundaryCanSee, getNetworkBoundary } from "../util/boundary";
import { DIAGNOSTIC_CODE } from "../util/constants";
import { getImports } from "../util/imports";
import { Provider } from "../util/provider";

const NON_ASSIGNABLE_REGEX = /Property '_nominal_(.*)' is missing in type '(.*)' but required in type '(.*)'./;

export function getSemanticDiagnosticsFactory(provider: Provider): ts.LanguageService["getSemanticDiagnostics"] {
	const { service, config } = provider;
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
					if (!BoundaryCanSee(currentBoundary, importBoundary)) {
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
				const match = NON_ASSIGNABLE_REGEX.exec(diagnostic.messageText);
				if (match) {
					diagnostic.messageText = `Type '${match[2]}' is not assignable to nominal type '${match[1]}'`;
				}
			}
		});

		return orig;
	};
}
