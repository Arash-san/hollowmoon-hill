// Treat table for officers: look up a student's ticket code and hand out real treats.
import './officer.css';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const key = new URLSearchParams(location.search).get('key') || sessionStorage.getItem('admin-key') || '';
if (key) sessionStorage.setItem('admin-key', key);
const api = (p, body) => fetch(`api/admin/${p}?key=${encodeURIComponent(key)}`, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}).then(async (r) => {
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.status);
  return r.json();
});

let players = [];
async function refresh() {
  try {
    const r = await api('players');
    players = r.players;
    $('#status').textContent = `👥 ${r.online} online`;
    const earned = players.reduce((a, p) => a + p.tickets, 0), given = players.reduce((a, p) => a + (p.redeemed || 0), 0);
    $('#stats').innerHTML = [['Players', players.length], ['Online now', r.online], ['Photo avatars', players.filter((p) => p.photo).length], ['Tickets earned', earned], ['Treats given', given], ['Treats waiting', earned - given]]
      .map(([k, v]) => `<div class="card">${k}<b>${v}</b></div>`).join('');
    render();
  } catch (e) {
    $('#status').textContent = e.message === 'bad key' ? '🔒 Wrong admin key in the link' : '⚠️ Server offline';
  }
}

function render() {
  const q = $('#search').value.trim().toLowerCase();
  const list = players.filter((p) => !q || p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q));
  list.sort((a, b) => b.tickets - (b.redeemed || 0) - (a.tickets - (a.redeemed || 0)) || b.online - a.online);
  $('#rows').innerHTML = list.slice(0, 200).map((p) => {
    const wait = p.tickets - (p.redeemed || 0);
    return `<tr class="${wait > 0 ? 'has' : ''}"><td><b>${esc(p.name)}</b><br><small>${p.online ? '🟢 online' : '⚪ offline'} · ${esc(p.title)}</small></td><td class="code">${esc(p.code)}</td><td>${p.quests}/12</td><td>🍬 ${p.candy}</td><td>🎟️ ${p.tickets}</td><td>${p.redeemed || 0}</td><td><span class="avail">${wait}</span></td>
      <td><button class="btn gold" data-give="${p.pid}" ${wait > 0 ? '' : 'disabled'}>Give a treat 🍬</button> <button class="btn" data-undo="${p.pid}" ${p.redeemed ? '' : 'disabled'}>Undo</button></td></tr>`;
  }).join('') || '<tr><td colspan="8">No match.</td></tr>';
}

$('#search').oninput = render;
$('#rows').onclick = async (e) => {
  const give = e.target.closest('[data-give]'), undo = e.target.closest('[data-undo]');
  if (give) await api('redeem', { pid: give.dataset.give });
  if (undo) await api('redeem', { pid: undo.dataset.undo, undo: true });
  if (give || undo) refresh();
};
$('#send').onclick = async () => {
  const text = $('#announce').value.trim();
  if (!text) return;
  await api('announce', { text });
  $('#announce').value = '';
  $('#status').textContent = '📣 Sent!';
};

refresh();
setInterval(refresh, 5000);
window.__ready = true;
