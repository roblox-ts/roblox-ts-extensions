import ts from "typescript";
import path from "path";
import { Provider } from "../provider";
import { isPathDescendantOf } from "../../Rojo/RojoResolver/fsUtil";

export function isNodeInternal(provider: Provider, node: ts.Node) {
	const sourceFile = node.getSourceFile();
	if (sourceFile) {
		const currentDir = provider.currentDirectory;
		const typesPath = "node_modules/@rbxts/types";
		const compilerTypesPath = "node_modules/@rbxts/compiler-types";
		return (
			isPathDescendantOf(path.join(currentDir, typesPath), sourceFile.fileName) ||
			isPathDescendantOf(path.join(currentDir, compilerTypesPath), sourceFile.fileName)
		);
	}
	return false;
}
