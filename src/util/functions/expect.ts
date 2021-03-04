export function expect<T>(condition: T, ...meta: string[]): NonNullable<T> {
	if (condition === null || condition === undefined)
		throw new Error("Unexpected null or undefined value" + (meta.length > 0 ? ": " + meta.join(", ") : ""));
	return condition as NonNullable<T>;
}
