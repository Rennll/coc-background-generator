/** Browser-only side effects. Keep business logic modules independent of these APIs. */
export async function copyText(text) {
  if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(String(text)); return; }
  const textarea = document.createElement("textarea");
  textarea.value = String(text); textarea.setAttribute("readonly", "");
  textarea.className = "clipboard-fallback";
  document.body.appendChild(textarea); textarea.select();
  const copied = document.execCommand("copy"); textarea.remove();
  if (!copied) throw new Error("Clipboard copy is not available in this browser.");
}
export function downloadText(filename, text, mimeType = "text/plain;charset=utf-8") {
  const blob = new Blob([String(text)], { type: mimeType }), url = URL.createObjectURL(blob);
  const link = document.createElement("a"); link.href = url; link.download = filename;
  document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
}
