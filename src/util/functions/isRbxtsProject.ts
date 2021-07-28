import type tslib from "typescript";
import fs from "fs";
import { PluginCreateInfo } from "../../types";

/**
 * Checks if this project is a roblox-ts project.
 */
export function isRbxtsProject(ts: typeof tslib, info: PluginCreateInfo) {
	const pkg = ts.findPackageJson(info.project.getCurrentDirectory(), info.languageServiceHost);
	if (!pkg) return false;

	const contents = fs.readFileSync(pkg, { encoding: "ascii" });
	const packageJson = JSON.parse(contents);
	if (!packageJson) return false;

	const devDependencies = packageJson.devDependencies;
	if (typeof devDependencies === "object" && devDependencies["@rbxts/compiler-types"]) {
		console.log("found @rbxts/compilerTypes in devDeps");
		return true;
	}

	const dependencies = packageJson.dependencies;
	if (typeof dependencies === "object" && dependencies["@rbxts/compiler-types"]) {
		console.log("found @rbxts/compilerTypes in deps");
		return true;
	}

	return false;
}
