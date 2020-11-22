type Service = ts.LanguageService;
type Key = keyof Service;

/**
 * Create a proxy LanguageService for decoration.
 * @param object The LanguageService.
 */
export function createProxy(object: Service): Service {
	const proxy = Object.create(null);

	for (const k in Object.keys(object)) {
		const x = object[k as Key] as any;
		proxy[k] = (...args: unknown[]) => x(object, ...args);
	}

	return proxy;
}
