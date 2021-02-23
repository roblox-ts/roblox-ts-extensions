import ts from "typescript";
import { DIAGNOSTIC_CODE } from "../util/constants";
import { Provider } from "../util/provider";

export function getCodeFixesAtPositionFactory(provider: Provider): ts.LanguageService["getCodeFixesAtPosition"] {
	const { service, serviceProxy } = provider;
	return (file, start, end, codes, formatOptions, preferences) => {
		let orig = service.getCodeFixesAtPosition(file, start, end, codes, formatOptions, preferences);

		const semanticDiagnostics = serviceProxy.getSemanticDiagnostics(file).filter((x) => x.code === DIAGNOSTIC_CODE);
		semanticDiagnostics.forEach((diag) => {
			if (diag.start !== undefined && diag.length !== undefined) {
				if (start >= diag.start && end <= diag.start + diag.length) {
					const sourceFile = provider.getSourceFile(file);
					const $import = provider.findImport(sourceFile, diag.start);
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
}
