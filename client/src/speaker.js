// Room speaker: listens to the game (as an officer listener, not a player) and reads announcements out loud with
// the browser's text to speech, plus a gong for big moments. speaker.html?key=<admin key>
import './officer.css';

const $ = (s) => document.querySelector(s);
const key = new URLSearchParams(location.search).get('key') || sessionStorage.getItem('admin-key') || '';
if (key) sessionStorage.setItem('admin-key', key);
let ctx = null, voice = null, ws = null;

function pickVoice() {
  const all = speechSynthesis.getVoices().filter((v) => /^en/i.test(v.lang));
  // a deep, theatrical voice suits the Mayor; fall back to any English voice
  voice = all.find((v) => /david|guy|george|daniel|male/i.test(v.name)) || all[0] || null;
}

function gong() {
  if (!ctx) return;
  const t = ctx.currentTime;
  for (const [f, g] of [[98, 0.5], [147, 0.25], [196, 0.15]]) {
    const o = ctx.createOscillator(), a = ctx.createGain();
    o.frequency.value = f;
    a.gain.setValueAtTime(g, t);
    a.gain.exponentialRampToValueAtTime(0.001, t + 3.5);
    o.connect(a).connect(ctx.destination);
    o.start(t);
    o.stop(t + 3.6);
  }
}

function say(text, loud = false, audio = null) {
  const clean = String(text).replace(/\p{Extended_Pictographic}/gu, '').replace(/\s+/g, ' ').trim();
  if (!clean) return;
  $('#last').textContent = text;
  const li = document.createElement('li');
  li.textContent = `${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · ${text}`;
  $('#log').prepend(li);
  if (loud) gong();
  if (audio) {
    // the Mayor's Kokoro voice from the game server
    const a = new Audio(`api/tts/${audio}.wav`);
    setTimeout(() => a.play().catch(() => {}), loud ? 900 : 0);
    return;
  }
  const u = new SpeechSynthesisUtterance(clean);
  if (voice) u.voice = voice;
  u.pitch = 0.6;
  u.rate = 0.95;
  setTimeout(() => speechSynthesis.speak(u), loud ? 900 : 0);
}

function connect() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const base = location.pathname.replace(/[^/]*$/, '');
  ws = new WebSocket(`${proto}://${location.host}${base}ws`);
  ws.onopen = () => ws.send(JSON.stringify({ t: 'listen', key }));
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.t === 'listening') $('#status').textContent = '🟢 Listening';
    if (m.t === 'error') $('#status').textContent = `🔒 ${m.text}`;
    if (m.t === 'say') say(m.text, true, m.audio);
    if (m.t === 'toast' && $('#toasts').checked && ['boss', 'win'].includes(m.kind)) say(m.text);
  };
  ws.onclose = () => {
    $('#status').textContent = '⚠️ Reconnecting…';
    setTimeout(connect, 2000);
  };
}

speechSynthesis.onvoiceschanged = pickVoice;
pickVoice();
$('#start').onclick = () => {
  ctx ||= new AudioContext();
  ctx.resume();
  $('#start').classList.add('hidden');
  say('Good evening, Hollowmoon Hill! The Mayor\'s megaphone is ready.', true);
  if (!ws) connect();
};
window.__ready = true;
