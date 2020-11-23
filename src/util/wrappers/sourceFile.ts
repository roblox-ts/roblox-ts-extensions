import { expect } from "../../util/expect";
import { Provider } from "../provider";

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
			return this.getTextRange(start, start + length - 1);
		}
	}
}
