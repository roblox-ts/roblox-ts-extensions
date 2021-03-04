import ts from "typescript";

/**
 * Check if a node has a specific jsdoc tag.
 * @param node The node to check
 * @param name The name of the jsdoc tag
 */
export function hasJSDocTag(node: ts.Node, name: string) {
	return ts.getAllJSDocTags(node, (tag): tag is ts.JSDocTag => tag.tagName.text === name).length > 0;
}
