function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }

export function renderMarkdown(text) {
  if (!text) return ''
  let s = text
  s = s.replace(/```(\w*)\n?([\s\S]*?)```/g, (_,lang,code) =>
    `<pre class="md-pre"><code class="md-code">${esc(code.trimEnd())}</code></pre>`)
  s = s.replace(/`([^`\n]+)`/g, (_,c) => `<code class="md-ic">${esc(c)}</code>`)
  s = s.replace(/^### (.+)$/gm, '<h3 class="md-h3">$1</h3>')
  s = s.replace(/^## (.+)$/gm,  '<h2 class="md-h2">$1</h2>')
  s = s.replace(/^# (.+)$/gm,   '<h1 class="md-h1">$1</h1>')
  s = s.replace(/^> (.+)$/gm,   '<blockquote class="md-bq">$1</blockquote>')
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/\*(.+?)\*/g,     '<em>$1</em>')
  s = s.replace(/(\|.+\|\n\|[-| :]+\|\n(?:\|.+\|\n?)+)/g, m => {
    const rows = m.trim().split('\n').filter(r => !/^\|[-| :]+\|$/.test(r))
    const [h,...body] = rows
    const ths = h.split('|').filter(x=>x.trim()).map(x=>`<th>${x.trim()}</th>`).join('')
    const trs = body.map(r=>`<tr>${r.split('|').filter(x=>x.trim()).map(x=>`<td>${x.trim()}</td>`).join('')}</tr>`).join('')
    return `<table class="md-table"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`
  })
  s = s.replace(/^[-*] (.+)$/gm, '<li class="md-li">$1</li>')
  s = s.replace(/(<li[\s\S]*?<\/li>\n?)+/g, m => `<ul class="md-ul">${m}</ul>`)
  s = s.replace(/^---$/gm, '<hr class="md-hr"/>')
  s = '<p class="md-p">' + s.replace(/\n\n(?!<)/g,'</p><p class="md-p">') + '</p>'
  s = s.replace(/<p class="md-p"><\/p>/g,'').replace(/<p class="md-p">(<[hupbt])/g,'$1').replace(/(<\/[hupbt][^>]*>)<\/p>/g,'$1')
  return s
}

export const mdCss = `
  .md-h1 { font-size:22px; font-weight:700; margin:20px 0 10px; color:#0f172a; }
  .md-h2 { font-size:18px; font-weight:700; margin:18px 0 8px; border-bottom:2px solid #e2e8f0; padding-bottom:6px; color:#0f172a; }
  .md-h3 { font-size:15px; font-weight:700; margin:14px 0 6px; color:#0891b2; }
  .md-p  { margin:0 0 10px; line-height:1.8; color:#334155; }
  .md-pre { background:#1e293b; border:1px solid #334155; border-radius:8px; padding:14px 16px; overflow-x:auto; margin:10px 0; }
  .md-code { font-family:'JetBrains Mono',monospace; font-size:13px; color:#e2e8f0; line-height:1.6; white-space:pre; }
  .md-ic { background:#dbeafe; color:#1d4ed8; font-family:'JetBrains Mono',monospace; font-size:13px; padding:2px 7px; border-radius:4px; }
  .md-bq { border-left:3px solid #2563eb; padding:8px 16px; margin:10px 0; background:#eff6ff; border-radius:0 6px 6px 0; color:#334155; }
  .md-table { width:100%; border-collapse:collapse; margin:10px 0; font-size:14px; }
  .md-table th { background:#f1f5f9; padding:8px 12px; text-align:left; border:1px solid #e2e8f0; font-weight:600; color:#0f172a; }
  .md-table td { padding:8px 12px; border:1px solid #e2e8f0; color:#334155; }
  .md-table tr:nth-child(even) td { background:#f8fafc; }
  .md-ul { padding-left:20px; margin:6px 0 10px; }
  .md-li { margin-bottom:5px; line-height:1.65; color:#334155; }
  .md-hr { border:none; border-top:1px solid #e2e8f0; margin:16px 0; }
`
