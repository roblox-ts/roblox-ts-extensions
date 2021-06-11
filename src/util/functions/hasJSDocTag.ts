import type ts from "typescript";
import { Provider } from "../provider";

/**
 * Check if a node has a specific jsdoc tag.
 * @param node The node to check
 * @param name The name of the jsdoc tag
 */
export function hasJSDocTag(provider: Provider, node: ts.Node, name: string) {
	const { ts } = provider;
	return ts.getAllJSDocTags(node, (tag): tag is ts.JSDocTag => tag.tagName.text === name).length > 0;
}
