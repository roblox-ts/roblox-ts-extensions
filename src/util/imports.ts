import type ts from "typescript";
import path from "path";
import { assert } from "../Rojo/PathTranslator/assert";
import { Provider } from "./provider";

/**
 * Converts a module specifier into an absolute path.
 * @param filePath The source file path
 * @param importPath The module specifier
 */
export function transformImportPath(provider: Provider, filePath: string, importPath: string): string {
	return importPath.startsWith(".")
		? path.join(path.dirname(filePath), importPath)
		: path.join(provider.srcDir, importPath);
}

/**
 * Converts an import declaration into an ImportInfo object.
 * @param declaration The import declaration
 */
export function getImportInfo(provider: Provider, declaration: ts.ImportDeclaration) {
	const { ts } = provider;
	const { moduleSpecifier, importClause } = declaration;
	assert(importClause && ts.isStringLiteral(moduleSpecifier));
	const path = moduleSpecifier.text;
	return {
		path,
		absolutePath: transformImportPath(provider, declaration.getSourceFile().fileName, path),
		typeOnly: importClause.isTypeOnly,
		end: declaration.getEnd(),
		start: declaration.getStart(),
	};
}

/**
 * Find an import at the specified position.
 * @param sourceFile The source file
 * @param pos The position to check
 */
export function findImport(provider: Provider, sourceFile: ts.SourceFile, pos: number): ImportInfo | undefined {
	const { ts } = provider;
	const node = ts.getTokenAtPosition(sourceFile, pos);
	const importDeclaration = ts.findAncestor(node, (decl): decl is ts.ImportDeclaration =>
		ts.isImportDeclaration(decl),
	);
	if (importDeclaration) {
		return getImportInfo(provider, importDeclaration);
	}
}

/**
 * Get all the imports in a specific source file.
 * @param sourceFile The source file
 */
export function getImports(provider: Provider, sourceFile: ts.SourceFile) {
	const { ts } = provider;
	const imports: ImportInfo[] = [];

	for (const statement of sourceFile.statements) {
		if (ts.isImportDeclaration(statement)) {
			imports.push(getImportInfo(provider, statement));
		}
	}

	return imports;
}

/**
 * Information about a specific import.
 */
export type ImportInfo = {
	path: string;
	absolutePath: string;
	typeOnly: boolean;
	start: number;
	end: number;
};
