// Utility for JSON syntax highlighting

/**
 * Highlights JSON syntax by wrapping tokens in HTML spans with CSS classes
 * @param jsonString - The JSON string to highlight
 * @returns HTML string with syntax highlighting
 */
export function highlightJsonToHtml(jsonString: string): string {
  // Regex to match JSON tokens
  const regex = /"([^"]+)"(?=\s*:)|"([^"]*)"|(\btrue\b|\bfalse\b)|(\bnull\b)|(-?\d+\.?\d*)|([{}[\],:])/g;

  return jsonString.replace(regex, (match, key, string, bool, nullVal, number, punct) => {
    if (key !== undefined) {
      return `<span class="json-key">"${key}"</span>`;
    } else if (string !== undefined) {
      return `<span class="json-string">"${string}"</span>`;
    } else if (bool !== undefined) {
      return `<span class="json-boolean">${bool}</span>`;
    } else if (nullVal !== undefined) {
      return `<span class="json-null">${nullVal}</span>`;
    } else if (number !== undefined) {
      return `<span class="json-number">${number}</span>`;
    } else if (punct !== undefined) {
      return `<span class="json-punctuation">${punct}</span>`;
    }
    return match;
  });
}
