export function buildSelectOptions<T extends { id: string; code?: string; name?: string }>(items: T[]) {
  return items.map((item) => ({
    value: item.id,
    label: item.code ? `${item.code} - ${item.name}` : item.name || item.id,
  }));
}

export function uniqueOptions(values: Array<string | undefined>) {
  return Array.from(new Set(values.filter(Boolean) as string[])).map((value) => ({
    value,
    label: value,
  }));
}
