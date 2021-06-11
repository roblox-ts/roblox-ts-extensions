import type ts from "typescript";
import { Provider } from "../provider";

export function findPrecedingType(provider: Provider, precedingToken: ts.Node): ts.Type | undefined {
	const { typeChecker, ts } = provider;
	const { parent } = precedingToken;
	if (ts.isPropertyAccessExpression(parent) || ts.isElementAccessExpression(parent)) {
		return typeChecker.getTypeAtLocation(parent.expression);
	}
}
