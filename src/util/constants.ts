import { getConfig } from "../config";
import { PathTranslator } from "../Rojo/PathTranslator";
import { PluginCreateInfo } from "../types";

export function createConstants(info: PluginCreateInfo) {
	const currentDirectory = info.languageServiceHost.getCurrentDirectory();
	const compilerOptions = info.project.getCompilerOptions();
	const formatOptions = info.project.projectService.getHostFormatCodeOptions();
	const userPreferences = info.project.projectService.getHostPreferences();
	const outDir = compilerOptions.outDir ?? currentDirectory;
	const srcDir = compilerOptions.rootDir ?? currentDirectory;
	const pathTranslator = new PathTranslator(srcDir, outDir, undefined, false);
	const config = getConfig(info.config);
	const log = (arg: string) => info.project.projectService.logger.info("[Roblox-TS Extensions]: " + arg);

	return {
		config,
		currentDirectory,
		compilerOptions,
		userPreferences,
		pathTranslator,
		formatOptions,
		outDir,
		srcDir,
		log,
	};
}

export enum Diagnostics {
	CrossBoundaryImport = 1800000,
}

export type Constants = ReturnType<typeof createConstants>;

export const EXISTING_IMPORT_PATTERN = /^Add '.*' to existing import declaration from/;
export const NEW_IMPORT_PATTERN = /^Import '.*' from module/;

export const IMPORT_PATTERN = /import\s*(type)?\s*{\s*(?:(?=((?:\w*(?:\s*,\s*)?)*))\2)\s*?}\s*from\s*['"](.*)['"]/;
