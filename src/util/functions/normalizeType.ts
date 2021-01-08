import ts from "typescript";

export function normalizeType(type: ts.Type): ts.Type[] {
	return type.isUnionOrIntersection() ? type.types : [type];
}
