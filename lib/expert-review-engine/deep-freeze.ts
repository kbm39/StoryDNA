/**
 * Deep-freeze plain objects and arrays for registry immutability (P2-04).
 *
 * Recursively freezes nested structures in deterministic key order.
 * Map and Set are not used in ExpertRuntimeDefinition; they are rejected if encountered.
 */

function unsupportedTypeError(value: object): TypeError {
  return new TypeError(
    `deepFreeze: unsupported type ${Object.prototype.toString.call(value)}`,
  );
}

function assertFreezable(value: unknown, seen: WeakSet<object>): void {
  if (value === null || typeof value !== "object") {
    return;
  }

  const objectValue = value as object;
  if (seen.has(objectValue)) {
    return;
  }
  seen.add(objectValue);

  if (Array.isArray(value)) {
    for (const element of value) {
      assertFreezable(element, seen);
    }
    return;
  }

  if (value instanceof Map || value instanceof Set || value instanceof Date) {
    throw unsupportedTypeError(objectValue);
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw unsupportedTypeError(objectValue);
  }

  for (const key of Reflect.ownKeys(value)) {
    assertFreezable((value as Record<PropertyKey, unknown>)[key], seen);
  }
}

function collectFreezableObjects(value: unknown, seen: WeakSet<object>, objects: object[]): void {
  if (value === null || typeof value !== "object") {
    return;
  }

  const objectValue = value as object;
  if (seen.has(objectValue)) {
    return;
  }
  seen.add(objectValue);

  if (Array.isArray(value)) {
    for (const element of value) {
      collectFreezableObjects(element, seen, objects);
    }
    objects.push(objectValue);
    return;
  }

  for (const key of Reflect.ownKeys(value)) {
    collectFreezableObjects((value as Record<PropertyKey, unknown>)[key], seen, objects);
  }
  objects.push(objectValue);
}

/**
 * Recursively freeze plain objects and arrays.
 *
 * - Preserves the identity of the root value passed in (mutates in place after clone).
 * - Validates the full tree before freezing anything (all-or-nothing on unsupported types).
 * - Handles shared/cyclic references safely via a visited set.
 * - Does not traverse Map, Set, Date, or class instances.
 */
export function deepFreeze<T>(value: T): T {
  assertFreezable(value, new WeakSet());

  const objects: object[] = [];
  collectFreezableObjects(value, new WeakSet(), objects);
  for (const objectValue of objects) {
    Object.freeze(objectValue);
  }

  return value;
}
