// Game Master page for officers: start or schedule events, announce, and calm down griefers (gm.html?key=<admin key>).
import './officer.css';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const key = new URLSearchParams(location.search).get('key') || sessionStorage.getItem('admin-key') || '';
if (key) sessionStorage.setItem('admin-key', key);
$('#treats-link').href = `admin.html?key=${encodeURIComponent(key)}`;
const api = (p, body) => fetch(`api/admin/${p}?key=${encodeURIComponent(key)}`, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}).then(async (r) => {
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || r.status);
  return j;
});
const flash = (text) => {
  $('#status').textContent = text;
  clearTimeout(flash.t);
  flash.t = setTimeout(refresh, 2500);
};
const left = (ms) => (ms > 60000 ? `${Math.ceil(ms / 60000)} min` : `${Math.ceil(ms / 1000)} s`);

let view = null;
async function refresh() {
  try {
    view = await api('gm');
    $('#status').textContent = `👥 ${view.online.length} online · boss: ${view.boss}`;
    if (!$('#events').childElementCount) {
      $('#events').innerHTML = Object.entries(view.events).map(([k, e]) => `<button class="btn big" data-ev="${k}">${e.icon} ${esc(e.label)}</button>`).join('');
      $('#sched-kind').innerHTML = Object.entries(view.events).map(([k, e]) => `<option value="${k}">${e.icon} ${esc(e.label)}</option>`).join('');
    }
    $('#schedule').innerHTML = view.schedule.map((s) => `<li class="${s.done ? 'done' : ''}">${view.events[s.kind]?.icon || ''} <b>${esc(view.events[s.kind]?.label || s.kind)}</b> at ${new Date(s.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
      ${s.done ? '· done' : `· in ${left(s.at - Date.now())} <button class="btn" data-unsched="${s.id}">Cancel</button>`}</li>`).join('') || '<li class="hint">Nothing scheduled.</li>';
    render();
  } catch (e) {
    $('#status').textContent = e.message === 'bad key' ? '🔒 Wrong admin key in the link' : '⚠️ Server offline';
  }
}

function render() {
  if (!view) return;
  const q = $('#search').value.trim().toLowerCase();
  const list = view.online.filter((p) => !q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q));
  $('#rows').innerHTML = list.map((p) => {
    const mods = Object.entries(p.mod).map(([k, ms]) => `<span class="tag">${view.mods[k]?.icon} ${left(ms)}</span>`).join(' ') || '<span class="hint">ok</span>';
    return `<tr><td><b>${esc(p.name)}</b><br><small>${esc(p.title)}</small></td><td class="code">${esc(p.code)}</td><td>${p.quests}</td><td>${mods}</td>
      <td class="acts">${Object.entries(view.mods).map(([k, m]) => `<button class="btn" data-mod="${k}" data-pid="${p.pid}" title="${esc(m.label)}">${m.icon} ${esc(m.label)}</button>`).join('')}
      <button class="btn" data-mod="plaza" data-pid="${p.pid}">⛲ To plaza</button>${Object.keys(p.mod).length ? `<button class="btn teal" data-mod="clear" data-pid="${p.pid}">✅ Clear</button>` : ''}</td></tr>`;
  }).join('') || '<tr><td colspan="5" class="hint">Nobody online right now.</td></tr>';
}

$('#events').onclick = async (e) => {
  const b = e.target.closest('[data-ev]');
  if (!b) return;
  try {
    await api('event', { kind: b.dataset.ev });
    flash(`✅ Started: ${view.events[b.dataset.ev].label}`);
  } catch (x) {
    flash(`⚠️ ${x.message}`);
  }
};
$('#sched-add').onclick = async () => {
  let at = 0;
  const mins = Number($('#sched-in').value);
  if (mins) at = Date.now() + mins * 60000;
  else if ($('#sched-time').value) {
    const [h, m] = $('#sched-time').value.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    at = d.getTime();
  }
  try {
    await api('schedule', { kind: $('#sched-kind').value, at });
    $('#sched-in').value = '';
    $('#sched-time').value = '';
    flash('⏰ Scheduled');
  } catch (x) {
    flash(`⚠️ ${x.message}`);
  }
};
$('#schedule').onclick = async (e) => {
  const b = e.target.closest('[data-unsched]');
  if (b) await api('schedule', { remove: b.dataset.unsched }), refresh();
};
$('#rows').onclick = async (e) => {
  const b = e.target.closest('[data-mod]');
  if (!b) return;
  await api('mod', { pid: b.dataset.pid, action: b.dataset.mod, minutes: Number($('#minutes').value) }).catch((x) => flash(`⚠️ ${x.message}`));
  refresh();
};
$('#search').oninput = render;
$('#send').onclick = async () => {
  const text = $('#announce').value.trim();
  if (!text) return;
  await api('announce', { text });
  $('#announce').value = '';
  flash('📣 Sent!');
};

refresh();
setInterval(refresh, 4000);
window.__ready = true;
