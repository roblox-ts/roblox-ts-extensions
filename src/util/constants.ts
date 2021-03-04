import { parseConfig } from "./functions/parseConfig";
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
	const config = parseConfig(info.config);

	return {
		config,
		currentDirectory,
		compilerOptions,
		userPreferences,
		pathTranslator,
		formatOptions,
		outDir,
		srcDir,
	};
}

export const DIAGNOSTIC_CODE = 1800000;

export type Constants = ReturnType<typeof createConstants>;
