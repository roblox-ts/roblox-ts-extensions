import ts from "typescript";
import { BoundaryCanSee, getNetworkBoundary } from "../util/boundary";
import { DIAGNOSTIC_CODE } from "../util/constants";
import { getImports } from "../util/imports";
import { Provider } from "../util/provider";

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

		return orig;
	};
}
