import type ts from "typescript";

type Service = ts.LanguageService & { addProxyMethods(): void };

/**
 * Create a proxy LanguageService for decoration.
 * @param object The LanguageService.
 */
export function createProxy(object: ts.LanguageService): Service {
	const proxy = Object.create(null);

	proxy.addProxyMethods = function () {
		for (const k in object) {
			if (proxy[k] === undefined) {
				proxy[k] = function () {
					return (object as any)[k].apply(object, arguments);
				};
			}
		}
	};

	return proxy;
}
