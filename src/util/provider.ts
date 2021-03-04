import { createConstants } from "./constants";
import { expect } from "./functions/expect";
import { existsSync } from "fs-extra";
import path from "path";
import ts from "typescript";
import { PluginCreateInfo } from "../types";
import { RojoResolver } from "../Rojo/RojoResolver";

export class Provider {
	public constants = createConstants(this.info);
	public rojoResolver?: RojoResolver;

	public currentDirectory = this.constants.currentDirectory;
	public projectService = this.info.project.projectService;
	public pathTranslator = this.constants.pathTranslator;
	public logger = this.projectService.logger;
	public srcDir = this.constants.srcDir;
	public config = this.constants.config;

	constructor(
		public serviceProxy: ts.LanguageService,
		public service: ts.LanguageService,
		public info: PluginCreateInfo,
	) {
		const rojoConfig = RojoResolver.findRojoConfigFilePath(this.constants.currentDirectory);
		if (rojoConfig) {
			this.log("Found rojoConfig: " + rojoConfig);
			this.rojoResolver = RojoResolver.fromPath(rojoConfig);
		}
	}

	get program() {
		return expect(this.service.getProgram(), "getProgram");
	}

	/**
	 * Log values to the console, all non-strings will be stringified.
	 * @param args The values to be logged.
	 */
	log(...args: unknown[]) {
		const stringArgs = new Array<string>();
		for (const arg of args) {
			stringArgs.push(typeof arg === "string" ? arg : JSON.stringify(arg));
		}
		this.logger.info(stringArgs.join(", "));
		return stringArgs;
	}

	/**
	 * Gets the source file for a file.
	 * @param file The file path
	 */
	getSourceFile(file: string): ts.SourceFile {
		return expect(this.program.getSourceFile(file), "getSourceFile");
	}

	private _isRbxtsProject: boolean = this.isRbxtsProject();
	private _ttl = 0;

	/**
	 * Checks if this project is a roblox-ts project.
	 */
	isRbxtsProject() {
		const compilerTypesPath = path.join(this.currentDirectory, "node_modules", "@rbxts", "compiler-types");
		const currentTime = new Date().getTime();
		if (!this._isRbxtsProject && this._ttl < currentTime) {
			this._ttl = currentTime + 3000;
			this._isRbxtsProject = existsSync(compilerTypesPath);
		}
		return this._isRbxtsProject;
	}
}
