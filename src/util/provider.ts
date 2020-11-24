import { Constants } from "./constants";
import { expect } from "./expect";
import { SourceFile } from "./wrappers/sourceFile";
import path from "path";

export class Provider {
	constructor(
		public constants: Constants,
		public hookedService: ts.LanguageService,
		public service: ts.LanguageService,
		public info: ts.server.PluginCreateInfo
	) {	};

	get program() {
		return expect(this.service.getProgram(), "getProgram")
	}

	getSourceFile(file: string): SourceFile {
		return new SourceFile (
			expect(this.program.getSourceFile(file), "getSourceFile", file),
			this
		)
	}
}
