import { Constants } from "./constants";
import { expect } from "./expect";
import { SourceFile } from "./wrappers/sourceFile";

export class Provider {
	public program: ts.Program;
	constructor(
		public constants: Constants,
		public hookedService: ts.LanguageService,
		public service: ts.LanguageService,
		public info: ts.server.PluginCreateInfo
	) {
		this.program = expect(service.getProgram());
	};

	getSourceFile(file: string): SourceFile {
		return new SourceFile(
			expect(this.program.getSourceFile(file)),
			this
		)
	}
}
