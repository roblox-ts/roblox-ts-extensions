import { Constants } from "./constants";
import { expect } from "./expect";
import { SourceFile } from "./wrappers/sourceFile";
import { existsSync } from "fs-extra";
import path from "path";
import ts from "typescript";
import { PluginCreateInfo } from "../types";

export class Provider {
	public currentDir = this.constants.currentDirectory;
	constructor(
		public constants: Constants,
		public hookedService: ts.LanguageService,
		public service: ts.LanguageService,
		public info: PluginCreateInfo,
	) {}

	get program() {
		return expect(this.service.getProgram(), "getProgram");
	}

	getSourceFile(file: string): SourceFile {
		return new SourceFile(expect(this.program.getSourceFile(file), "getSourceFile", file), this);
	}

	transformImportPath(filePath: string, importPath: string): string {
		return importPath.startsWith(".")
			? path.join(path.dirname(filePath), importPath)
			: path.join(this.constants.srcDir, importPath);
	}

	private _isRbxtsProject: boolean = this.isRbxtsProject();
	private _ttl = 0;
	isRbxtsProject() {
		const compilerTypesPath = path.join(this.currentDir, "node_modules", "@rbxts", "compiler-types");
		const currentTime = new Date().getTime();
		if (!this._isRbxtsProject && this._ttl < currentTime) {
			this._ttl = currentTime + 3000;
			this._isRbxtsProject = existsSync(compilerTypesPath);
		}
		return this._isRbxtsProject;
	}
}
