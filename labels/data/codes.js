/** Parse / format code queues for printing. */
export function parseCodeLines(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("|").map((p) => p.trim());
      return { code: parts[0] || "", name: parts.slice(1).join(" | ") || "" };
    })
    .filter((x) => x.code);
}

export function itemsToText(items) {
  return (items || [])
    .map((it) => (it.name ? `${it.code} | ${it.name}` : it.code))
    .join("\n");
}

export function downloadJson(doc, filename = "label-template.json") {
  const blob = new Blob([JSON.stringify(doc, null, 2)], {
    type: "application/json"
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
