import { createConstants } from "./constants";
import { expect } from "./functions/expect";
import { existsSync } from "fs-extra";
import path from "path";
import ts from "typescript";
import { PluginCreateInfo } from "../types";
import { assert } from "../Rojo/PathTranslator/assert";
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

	log = (...args: unknown[]) => {
		const stringArgs = new Array<string>();
		for (const arg of args) {
			stringArgs.push(typeof arg === "string" ? arg : JSON.stringify(arg));
		}
		this.logger.info(stringArgs.join(", "));
		return stringArgs;
	};

	/**
	 * Gets the source file for a file.
	 * @param file The file path
	 */
	getSourceFile(file: string): ts.SourceFile {
		return expect(this.program.getSourceFile(file), "getSourceFile");
	}

	/**
	 * Converts a module specifier into an absolute path.
	 * @param filePath The source file path
	 * @param importPath The module specifier
	 */
	transformImportPath(filePath: string, importPath: string): string {
		return importPath.startsWith(".")
			? path.join(path.dirname(filePath), importPath)
			: path.join(this.constants.srcDir, importPath);
	}

	/**
	 * Converts an import declaration into an ImportInfo object.
	 * @param declaration The import declaration
	 */
	getImportInfo(declaration: ts.ImportDeclaration) {
		const { moduleSpecifier, importClause } = declaration;
		assert(importClause && ts.isStringLiteral(moduleSpecifier));
		const path = moduleSpecifier.text;
		return {
			path,
			absolutePath: this.transformImportPath(declaration.getSourceFile().fileName, path),
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
	findImport(sourceFile: ts.SourceFile, pos: number): ImportInfo | undefined {
		const node = ts.getTokenAtPosition(sourceFile, pos);
		const importDeclaration = ts.findAncestor(node, (decl): decl is ts.ImportDeclaration =>
			ts.isImportDeclaration(decl),
		);
		if (importDeclaration) {
			return this.getImportInfo(importDeclaration);
		}
	}

	/**
	 * Get all the imports in a specific source file.
	 * @param sourceFile The source file
	 */
	getImports(sourceFile: ts.SourceFile) {
		const imports: ImportInfo[] = [];

		for (const statement of sourceFile.statements) {
			if (ts.isImportDeclaration(statement)) {
				imports.push(this.getImportInfo(statement));
			}
		}

		return imports;
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

export type ImportInfo = {
	path: string;
	absolutePath: string;
	typeOnly: boolean;
	start: number;
	end: number;
};
