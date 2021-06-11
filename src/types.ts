import type ts from "typescript";

export interface PluginCreateInfo {
	project: import("typescript/lib/tsserverlibrary").server.Project;
	serverHost: import("typescript/lib/tsserverlibrary").server.ServerHost;
	languageService: ts.LanguageService;
	languageServiceHost: ts.LanguageServiceHost;
	config: any;
}
