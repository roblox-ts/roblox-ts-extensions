import * as z from "zod";

/**
 * The plugin's configuration.
 */
export interface PluginConfig {
	useRojo: boolean;
	convertExistingImports: boolean;
	client: string[];
	server: string[];
	mode: "remove" | "prefix";
	hideDeprecated: boolean;
	diagnosticsMode: "off" | "warning" | "error" | "message";
}

/**
 * Zod schema for configuration.
 */
const CONFIG_SCHEMA = z
	.object({
		mode: z.enum(["remove", "prefix"]),
		useRojo: z.boolean(),
		client: z.array(z.string()),
		server: z.array(z.string()),
		hideDeprecated: z.boolean(),
		diagnosticsMode: z.enum(["off", "warning", "error", "message"]),
	})
	.nonstrict()
	.partial();

/**
 * Get the PluginConfig with sanity checks and default values.
 * @param config The config directly from the plugin.
 */
export function getConfig(unsafeConfig: any): PluginConfig {
	const parsedConfig = CONFIG_SCHEMA.safeParse(unsafeConfig);
	const config = parsedConfig.success ? parsedConfig.data : {};
	return {
		mode: config.mode ?? "prefix",
		useRojo: config.useRojo ?? true,
		convertExistingImports: false,
		client: config.client ?? [],
		server: config.server ?? [],
		hideDeprecated: config.hideDeprecated ?? false,
		diagnosticsMode: config.diagnosticsMode ?? "warning",
	};
}
