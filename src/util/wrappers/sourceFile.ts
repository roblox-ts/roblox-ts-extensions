import { expect } from "../expect";
import { Provider } from "../provider";

type SeekResult = {
	len: number,
	start: number,
	end: number
}

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

	seek(start: number, text: string, direction: 1 | -1, maxDepth: number = 100): SeekResult | undefined {
		if (text.length === 0) return { start, end: start, len: text.length };

		for (let n = 0; n < maxDepth; n++) {
			const seekStart = start + (n * direction);
			const seekEnd = seekStart + text.length - 1;

			if (seekStart < 0) return;
			if (seekEnd > this.snapshot.getLength()) return;

			const seekText = this.getText(seekStart, text.length);
			if (seekText === text) {
				return {
					start: seekStart,
					end: seekEnd,
					len: text.length
				}
			}
		}
	}
}
