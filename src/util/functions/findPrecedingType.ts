import ts from "typescript";

export function findPrecedingType(
	typeChecker: ts.TypeChecker,
	pos: number,
	sourceFile: ts.SourceFile,
): ts.Type | undefined {
	const precedingToken = ts.findPrecedingToken(pos, sourceFile);
	let precedingType: ts.Type | undefined;
	if (precedingToken) {
		const { parent } = precedingToken;
		if (ts.isPropertyAccessExpression(parent) || ts.isElementAccessExpression(parent)) {
			precedingType = typeChecker.getTypeAtLocation(parent.expression);
		}
	}
	if (precedingType) {
		return precedingType;
	}
}
