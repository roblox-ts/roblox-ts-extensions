import { getConfig } from "../config";
import { PathTranslator } from "../Rojo/PathTranslator";

export function createConstants(info: ts.server.PluginCreateInfo) {
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
	}
}

export type Constants = ReturnType<typeof createConstants>;