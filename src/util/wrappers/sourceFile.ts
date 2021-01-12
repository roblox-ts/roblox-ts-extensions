import { expect } from "../expect";
import { Provider } from "../provider";
import ts from "typescript";
import { assert } from "../../Rojo/PathTranslator/assert";

type LineInfo = {
	text: string;
	start: number;
	end: number;
	len: number;
	lineNumber: number;
};

type ImportInfo = {
	path: string;
	absolutePath: string;
	typeOnly: boolean;
	start: number;
	end: number;
};

type SeekResult = {
	len: number;
	start: number;
	end: number;
};

export class SourceFile {
	public snapshot: ts.IScriptSnapshot;
	constructor(public inner: ts.SourceFile, private provider: Provider) {
		this.snapshot = expect(provider.info.languageServiceHost.getScriptSnapshot(inner.fileName));
	}

	getTextRange(start: number, end: number) {
		return this.snapshot.getText(start, end);
	}

	getText(start: number, length: number) {
		if (length < 0) {
			return this.getTextRange(start - length + 1, start);
		} else {
			return this.getTextRange(start, start + length);
		}
	}

	transformImportPath(importPath: string) {
		return this.provider.transformImportPath(this.inner.fileName, importPath);
	}

	getImportInfo(declaration: ts.ImportDeclaration) {
		const { moduleSpecifier, importClause } = declaration;
		assert(importClause && ts.isStringLiteral(moduleSpecifier));
		const path = moduleSpecifier.text;
		return {
			path,
			absolutePath: this.transformImportPath(path),
			typeOnly: importClause.isTypeOnly,
			end: declaration.getEnd(),
			start: declaration.getStart(),
		};
	}

	getImport(pos: number): ImportInfo | undefined {
		const node = ts.getTokenAtPosition(this.inner, pos);
		const importDeclaration = ts.findAncestor(node, (decl): decl is ts.ImportDeclaration =>
			ts.isImportDeclaration(decl),
		);
		if (importDeclaration) {
			return this.getImportInfo(importDeclaration);
		}
	}

	getImports() {
		const imports: ImportInfo[] = [];

		for (const statement of this.inner.statements) {
			if (ts.isImportDeclaration(statement)) {
				imports.push(this.getImportInfo(statement));
			}
		}

		return imports;
	}

	getLines() {
		const lines: LineInfo[] = [];
		for (const start of this.inner.getLineStarts()) {
			const end = this.inner.getLineEndOfPosition(start);
			const len = end - start;
			lines.push({
				start,
				end,
				len,
				lineNumber: lines.length,
				text: this.getText(start, len),
			});
		}
		return lines;
	}

	seek(start: number, text: string, direction: 1 | -1, maxDepth = 100): SeekResult | undefined {
		if (text.length === 0) return { start, end: start, len: text.length };

		for (let n = 0; n < maxDepth; n++) {
			const seekStart = start + n * direction;
			const seekEnd = seekStart + text.length - 1;

			if (seekStart < 0) return;
			if (seekEnd > this.snapshot.getLength()) return;

			const seekText = this.getText(seekStart, text.length);
			if (seekText === text) {
				return {
					start: seekStart,
					end: seekEnd,
					len: text.length,
				};
			}
		}
	}
}
