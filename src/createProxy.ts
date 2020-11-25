type Service = ts.LanguageService;
type Key = keyof Service;

/**
 * Create a proxy LanguageService for decoration.
 * @param object The LanguageService.
 */
export function createProxy(object: Service): Service {
	const proxy = Object.create(null);

	for (const k in object) {
		proxy[k] = function () { return (object as any)[k].apply(object, arguments) };
	}

	return proxy;
}
