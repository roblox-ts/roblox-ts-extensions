import ts from "typescript";

export function findPrecedingIdentifier(
	pos: number,
	sourceFile: ts.SourceFile,
	isFirstIteration = true,
): ts.Identifier | undefined {
	const precedingToken = ts.findPrecedingToken(pos, sourceFile);
	let precedingIdentifier: ts.Node | undefined;
	if (precedingToken) {
		if (ts.isIdentifier(precedingToken)) {
			console.log("preceding token", precedingToken.text);
		}
		switch (precedingToken.kind) {
			case ts.SyntaxKind.DotToken:
			case ts.SyntaxKind.QuestionDotToken:
				const newPrecedingToken = ts.findPrecedingToken(precedingToken.getFullStart() - 1, sourceFile);
				precedingIdentifier = newPrecedingToken;
				break;
			case ts.SyntaxKind.Identifier:
				if (isFirstIteration) {
					return findPrecedingIdentifier(precedingToken.getFullStart() - 1, sourceFile, false);
				}
				precedingIdentifier = precedingToken;
				break;
		}
	}
	if (precedingIdentifier && ts.isIdentifier(precedingIdentifier)) {
		return precedingIdentifier;
	}
}
