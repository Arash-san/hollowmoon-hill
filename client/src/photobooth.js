// The Photo Booth tent in Lantern Plaza. Players can take their own photo with the device camera (browsers only
// allow the camera on https, which is how officers and the event link reach the game), or show their code to the
// officers at the real camera table. The server turns the photo into a 3D look; the photo itself is not kept.
import { esc } from './ui.js';

const camOk = () => window.isSecureContext && !!navigator.mediaDevices?.getUserMedia;

// Pick (or shoot, on phones and tablets) a picture and send it. kind: 'selfie' | 'drawing'
function pickAndSend(ui, game, kind, status) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.capture = kind === 'drawing' ? 'environment' : 'user';
  input.onchange = async () => {
    const f = input.files?.[0];
    if (!f) return;
    status(kind === 'drawing' ? '🎃 Turning your drawing into a glowing pumpkin…' : '🪄 The booth spirits are designing your 3D look…');
    try {
      const r = await fetch(kind === 'drawing' ? 'api/drawing' : 'api/selfie', { method: 'POST', body: f, headers: { 'content-type': f.type || 'image/jpeg', 'x-hh-token': game.token } });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'The booth jammed. Try again!');
      ui.closeModal();
    } catch (x) {
      status(`😿 ${x.message}`);
    }
  };
  input.click();
}

// The "real pumpkin" part of the booth: draw a face on paper (or paint a real pumpkin), photograph it, and it becomes
// your glowing jack-o'-lantern in the plaza gallery and the pumpkin you turn into.
const DRAWING = `<div class="booth-drawing"><h3>🎃 Your own pumpkin</h3><p class="booth-alt">Draw a pumpkin face with a dark marker on paper (or paint a real pumpkin), then snap it. Your drawing becomes your glowing pumpkin in the game!</p><button class="btn orange" data-draw="1">🎃 Snap my pumpkin drawing</button></div>`;

export function photoBoothModal(ui, game) {
  const me = game.state;
  const code = `<div class="booth-code">Your code <b>${esc(me.code)}</b></div>`;
  const table = '<p class="booth-alt">At the event you can also show this code to an officer at the camera table, and they will snap you.</p>';
  const wire = (body) => {
    const status = (s) => {
      const el = body.querySelector('.booth-status');
      if (el) el.textContent = s;
    };
    body.querySelector('[data-draw]')?.addEventListener('click', () => pickAndSend(ui, game, 'drawing', status));
    body.querySelector('[data-upload]')?.addEventListener('click', () => pickAndSend(ui, game, 'selfie', status));
  };
  if (me.photo) {
    wire(ui.modal(`<div class="booth"><h2>📸 Photo Booth</h2><p>You already have your 3D look: <b>${esc(me.avatar?.title || '')}</b>! Want a different one? Ask an officer at the camera table for a retake.</p>${code}${DRAWING}<p class="booth-status"></p></div>`));
    return;
  }
  if (!camOk()) {
    wire(ui.modal(`<div class="booth"><h2>📸 Photo Booth</h2><p>Smile! The Photo Booth turns <b>your photo</b> into your own 3D character, costume and pet included. Wearing a costume? It copies that too!</p>
      <div class="booth-row"><button class="btn big orange" data-upload="1">📸 Take my photo</button></div>${code}
      <p class="booth-alt">Or show this code to an officer at the camera table and they will take your photo.</p>${DRAWING}<p class="booth-status"></p></div>`, { wide: true }));
    return;
  }
  let stream = null;
  const stop = () => stream?.getTracks().forEach((t) => t.stop());
  const body = ui.modal(`<div class="booth"><h2>📸 Photo Booth</h2>
    <p>Look at the camera and smile! We turn your photo into your own 3D character. The photo is <b>not saved</b>, only the look.</p>
    <div class="booth-cam"><video playsinline muted autoplay></video><canvas hidden></canvas><div class="flash"></div></div>
    <div class="booth-row"><button class="btn big orange snap">📸 Snap!</button><button class="btn retake hidden">↺ Retake</button><button class="btn big teal send hidden">✨ Make my 3D me</button></div>
    <p class="booth-status"></p>${code}${table}${DRAWING}</div>`, { onClose: stop, wide: true });
  wire(body);
  const video = body.querySelector('video'), canvas = body.querySelector('canvas');
  const status = (s) => (body.querySelector('.booth-status').textContent = s);
  const show = (sel, on) => body.querySelector(sel).classList.toggle('hidden', !on);
  let blob = null;
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false })
    .then((s) => {
      stream = s;
      video.srcObject = s;
    })
    .catch(() => status('The camera is blocked. Allow it in the browser, or show your code to an officer.'));
  body.querySelector('.snap').onclick = () => {
    if (!video.videoWidth) return status('The camera is still starting…');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob((b) => (blob = b), 'image/jpeg', 0.9);
    body.querySelector('.flash').animate([{ opacity: 1 }, { opacity: 0 }], { duration: 450 });
    game.audio.play('click');
    canvas.hidden = false;
    video.hidden = true;
    show('.snap', false);
    show('.retake', true);
    show('.send', true);
    status('Looking good! Use this one?');
  };
  body.querySelector('.retake').onclick = () => {
    blob = null;
    canvas.hidden = true;
    video.hidden = false;
    show('.snap', true);
    show('.retake', false);
    show('.send', false);
    status('');
  };
  body.querySelector('.send').onclick = async (e) => {
    if (!blob) return;
    e.currentTarget.disabled = true;
    status('🪄 The booth spirits are designing your 3D look…');
    try {
      const r = await fetch('api/selfie', { method: 'POST', body: blob, headers: { 'content-type': 'image/jpeg', 'x-hh-token': game.token } });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'The booth jammed. Try again!');
      stop();
      ui.closeModal(); // the reveal arrives as an avatar update
    } catch (x) {
      status(`😿 ${x.message}`);
      e.currentTarget.disabled = false;
    }
  };
}
