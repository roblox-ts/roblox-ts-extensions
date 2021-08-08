import type ts from "typescript";
import { Provider } from "../provider";

export function findPrecedingSymbol(provider: Provider, precedingToken: ts.Node): ts.Symbol | undefined {
	const { typeChecker, ts } = provider;
	const { parent } = precedingToken;

	if (ts.isQualifiedName(parent)) {
		return typeChecker.getSymbolAtLocation(parent.left);
	}
}
