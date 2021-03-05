/**
 * Attempts to get a value from an array, or uses defaultValue.
 */
export function getWithDefault<K, V>(map: Map<K, V>, key: K, defaultValue: V): V {
	let result = map.get(key);
	if (!result) map.set(key, (result = defaultValue));
	return result;
}
