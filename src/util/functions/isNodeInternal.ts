import ts from "typescript";
import path from "path";
import { Provider } from "../provider";
import { isInDirectory } from "./isInDirectory";

export function isNodeInternal(provider: Provider, node: ts.Node) {
	const sourceFile = node.getSourceFile();
	if (sourceFile) {
		const currentDir = provider.constants.currentDirectory;
		const typesPath = "node_modules/@rbxts/types";
		const compilerTypesPath = "node_modules/@rbxts/compiler-types";
		return (
			isInDirectory(path.join(currentDir, typesPath), sourceFile.fileName) ||
			isInDirectory(path.join(currentDir, compilerTypesPath), sourceFile.fileName)
		);
	}
	return false;
}
