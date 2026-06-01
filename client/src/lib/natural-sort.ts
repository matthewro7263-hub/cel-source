/**
 * Sorts an array of strings (e.g. filenames) using natural/numeric order.
 * E.g., panel_2.png comes before panel_10.png instead of after.
 */
export function naturalSort(arr: string[]): string[] {
  const collator = new Intl.Collator(undefined, {
    numeric: true,
    sensitivity: "base",
  });
  return [...arr].sort(collator.compare);
}

/**
 * Sorts objects by a string key using natural order.
 */
export function naturalSortBy<T>(arr: T[], keyFn: (item: T) => string): T[] {
  const collator = new Intl.Collator(undefined, {
    numeric: true,
    sensitivity: "base",
  });
  return [...arr].sort((a, b) => collator.compare(keyFn(a), keyFn(b)));
}
