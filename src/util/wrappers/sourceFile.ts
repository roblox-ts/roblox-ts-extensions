import { IMPORT_PATTERN } from "../constants";
import { expect } from "../expect";
import { Provider } from "../provider";
import ts from "typescript";

type LineInfo = {
	text: string;
	start: number;
	end: number;
	len: number;
	lineNumber: number;
};

type ImportInfo = {
	identifiers: string[];
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

	getImport(start: number, end: number = this.inner.getLineEndOfPosition(start)): ImportInfo | undefined {
		const lineMatch = IMPORT_PATTERN.exec(this.getTextRange(start, end).trim());
		if (lineMatch) {
			const identifiers = lineMatch[2]
				.split(",")
				.map((x) => x.trim())
				.filter((x) => !/\s/.test(x));
			return {
				path: lineMatch[3],
				absolutePath: this.transformImportPath(lineMatch[3]),
				typeOnly: lineMatch[1] === "type" ? true : false,
				identifiers,
				start,
				end,
			};
		}
	}

	getImports() {
		const imports: ImportInfo[] = [];

		let linesWithoutMatch = 0;
		for (const line of this.getLines()) {
			if (linesWithoutMatch >= 10) break;
			linesWithoutMatch++;

			const lineImport = this.getImport(line.start, line.end);
			if (lineImport) {
				imports.push(lineImport);
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
