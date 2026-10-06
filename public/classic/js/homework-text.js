export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const validUrl = raw => { try { const url = new URL(raw); return /^https?:$/.test(url.protocol) ? url.href : ''; } catch { return ''; } };

export function renderText(text) {
  const parts = String(text).split(/(\$[^$\n]+\$)/g);
  const inline = parts.map((part, i) => {
    if (i % 2 && typeof katex !== 'undefined') { try { return katex.renderToString(part.slice(1, -1), { throwOnError: false, trust: false }); } catch { return esc(part); } }
    return esc(part).replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, label, url) => `<a href="${esc(validUrl(url.replace(/&amp;/g, '&')))}" target="_blank" rel="noopener noreferrer">${label}</a>`).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>').replace(/`([^`]+)`/g, '<code>$1</code>');
  }).join('');
  const output = []; let list = false, plain = false;
  for (const line of inline.split('\n')) {
    const bullet = /^\s*[-*]\s+(.+)$/.exec(line);
    if (bullet) { if (!list) { if (plain) output.push('<br>'); output.push('<ul>'); } output.push(`<li>${bullet[1]}</li>`); list = true; plain = false; }
    else { if (list) output.push('</ul>'); if (plain) output.push('<br>'); output.push(line); list = false; plain = true; }
  }
  if (list) output.push('</ul>');
  return output.join('');
}
