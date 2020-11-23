export function expect<T>(condition: T): NonNullable<T> {
	if (condition === null || condition === undefined) throw new Error("Unexpected falsy value");
	return condition as NonNullable<T>;
}
