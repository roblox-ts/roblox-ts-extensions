import type ts from "typescript";
import { NetworkBoundary } from "../boundary";
import { Provider } from "../provider";

/**
 * Server -> Client, Client -> Server
 */
function getOppositeBoundary(boundary: NetworkBoundary): NetworkBoundary {
	return boundary === NetworkBoundary.Server ? NetworkBoundary.Client : NetworkBoundary.Server;
}

/**
 * Flatten a binary expression.
 * @param expression The expression to flatten
 * @param kind The operator to flatten
 * @returns A flattened array of expressions
 */
function flattenBinaryExpressionTree(provider: Provider, expression: ts.Expression, kind: ts.SyntaxKind) {
	const { ts } = provider;
	const flattened = new Array<ts.Expression>();
	if (ts.isBinaryExpression(expression) && expression.operatorToken.kind === kind) {
		flattened.push(...flattenBinaryExpressionTree(provider, expression.left, kind));
		flattened.push(...flattenBinaryExpressionTree(provider, expression.right, kind));
	} else {
		flattened.push(expression);
	}
	return flattened;
}

/**
 * Calculate whether an expression narrows the network boundary.
 * @param isServerSymbol The symbol for narrowing server boundary
 * @param isClientSymbol The symbol for narrowing client boundary
 * @returns A function which returns the narrowed boundary of an expression, or undefined if it couldn't be narrowed.
 */
function getBoundaryFromExpressionFactory(provider: Provider, isServerSymbol: ts.Symbol, isClientSymbol: ts.Symbol) {
	const { typeChecker, ts } = provider;
	return function getBoundaryFromExpression(expression: ts.Expression): NetworkBoundary | undefined {
		if (ts.isCallExpression(expression)) {
			const callSymbol = typeChecker.getSymbolAtLocation(expression.expression);
			return callSymbol === isServerSymbol
				? NetworkBoundary.Server
				: callSymbol === isClientSymbol
				? NetworkBoundary.Client
				: undefined;
		} else if (ts.isParenthesizedExpression(expression)) {
			return getBoundaryFromExpression(expression.expression);
		} else if (ts.isBinaryExpression(expression)) {
			const lhs = getBoundaryFromExpression(expression.left);
			const rhs = getBoundaryFromExpression(expression.right);

			const operator = expression.operatorToken.kind;
			switch (operator) {
				case ts.SyntaxKind.EqualsEqualsToken:
				case ts.SyntaxKind.EqualsEqualsEqualsToken:
					if (!lhs) return undefined;
					return expression.right.kind === ts.SyntaxKind.TrueKeyword
						? lhs
						: expression.right.kind === ts.SyntaxKind.FalseKeyword
						? getOppositeBoundary(lhs)
						: undefined;
				case ts.SyntaxKind.ExclamationEqualsToken:
				case ts.SyntaxKind.ExclamationEqualsEqualsToken:
					if (!lhs) return undefined;
					return expression.right.kind === ts.SyntaxKind.FalseKeyword
						? lhs
						: expression.right.kind === ts.SyntaxKind.TrueKeyword
						? getOppositeBoundary(lhs)
						: undefined;
				case ts.SyntaxKind.BarBarToken:
				case ts.SyntaxKind.BarBarEqualsToken:
					if (!lhs || !rhs) return undefined;
					return lhs === rhs ? lhs : undefined;
				case ts.SyntaxKind.AmpersandAmpersandToken:
					const flattenedTree = flattenBinaryExpressionTree(provider, expression, operator);
					let result: NetworkBoundary | undefined;
					for (const node of flattenedTree) {
						const nodeBoundary = getBoundaryFromExpression(node);
						result ??= nodeBoundary;
						if (nodeBoundary && nodeBoundary !== result) {
							return undefined;
						}
					}
					return result;
			}
		} else if (ts.isPrefixUnaryExpression(expression)) {
			const operator = expression.operator;
			const boundary = getBoundaryFromExpression(expression.operand);
			switch (operator) {
				case ts.SyntaxKind.ExclamationToken:
					return boundary ? getOppositeBoundary(boundary) : undefined;
			}
		}
	};
}

/**
 * Calculate narrowed boundary using RunService.IsServer/IsClient()
 * @param token The token to start at
 */
export function getBoundaryAtPosition(provider: Provider, token: ts.Node) {
	const { typeChecker, ts } = provider;
	const runServiceSymbol = typeChecker.resolveName("RunService", undefined, ts.SymbolFlags.All, false);
	if (!runServiceSymbol) return;
	if (!runServiceSymbol.declarations?.[0]) return;

	const runServiceType = typeChecker.getTypeAtLocation(runServiceSymbol.declarations[0]);

	const isServerSymbol = runServiceType.getProperty("IsServer");
	const isClientSymbol = runServiceType.getProperty("IsClient");
	if (!isServerSymbol || !isClientSymbol) return;

	const getBoundaryFromExpression = getBoundaryFromExpressionFactory(provider, isServerSymbol, isClientSymbol);

	return ts.forEachAncestor(token, (node) => {
		if (ts.isIfStatement(node)) {
			return getBoundaryFromExpression(node.expression);
		}
	});
}
