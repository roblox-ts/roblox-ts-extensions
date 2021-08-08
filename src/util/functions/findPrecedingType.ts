import type ts from "typescript";
import { Provider } from "../provider";

export function findPrecedingType(provider: Provider, precedingToken: ts.Node): ts.Type | undefined {
	const { typeChecker, ts } = provider;
	const { parent } = precedingToken;
	if (ts.isPropertyAccessExpression(parent) || ts.isElementAccessExpression(parent)) {
		return typeChecker.getTypeAtLocation(parent.expression);
	}

	if (ts.isStringLiteral(precedingToken)) {
		const { parent: accessType } = parent;
		if (accessType && ts.isIndexedAccessTypeNode(accessType)) {
			return typeChecker.getTypeAtLocation(accessType.objectType);
		}
	}

	if (ts.isQualifiedName(parent)) {
		const type = typeChecker.getTypeAtLocation(parent.left);
		if ((type.flags & ts.TypeFlags.Any) === 0) {
			return type;
		}
	}
}
