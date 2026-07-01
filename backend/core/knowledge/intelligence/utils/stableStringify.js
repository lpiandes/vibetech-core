function stableStringify(value) {
  const seen = new Set();

  const helper = (v) => {
    if (v === null) return "null";
    if (typeof v !== "object") return JSON.stringify(v);
    if (seen.has(v)) return '"[Circular]"';
    seen.add(v);

    if (Array.isArray(v)) {
      return `[${v.map((x) => helper(x)).join(",")}]`;
    }

    const keys = Object.keys(v).sort((a, b) => a.localeCompare(b));
    const body = keys
      .map((k) => `${JSON.stringify(k)}:${helper(v[k])}`)
      .join(",");
    return `{${body}}`;
  };

  return helper(value);
}

export { stableStringify };

