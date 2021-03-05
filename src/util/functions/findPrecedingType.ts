import ts from "typescript";

export function findPrecedingType(typeChecker: ts.TypeChecker, precedingToken: ts.Node): ts.Type | undefined {
	const { parent } = precedingToken;
	if (ts.isPropertyAccessExpression(parent) || ts.isElementAccessExpression(parent)) {
		return typeChecker.getTypeAtLocation(parent.expression);
	}
}
