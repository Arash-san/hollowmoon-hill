// HUD and panels (plain DOM). The game calls these; they call back through `handlers`.
import { VoiceTalk } from './voice.js';
import { icon, richText, leadIcon, splitLead, stripEmoji, iconize, hydrateIcons, EMOJI_ICON } from './icons.js';
import { PROPHECY, CLUES, CLUES_NEEDED } from '../../shared/story.js';
import { QUESTS, TICKET_EVERY, MAX_TICKETS, EMOTES, QUICK_CHAT, NPCS, TICKET_CANDY_PRICE, QUEST_ICON } from '../../shared/world.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// each NPC's icon (icons.js names)
export const NPC_ICON = { mayor: 'mayor', hex: 'hex', count: 'count', bones: 'bones', hayley: 'hayley', wisp: 'wisp', dj: 'dj' };
const TOAST_ICON = { good: 'check', boss: 'skull', win: 'star', heart: 'heart', announce: 'speaker', info: 'sparkle' };
const NPC_SUB = { mayor: 'Mayor of Hollowmoon Hill', hex: 'Potion maker · Haggle for potions!', count: 'Banker of the Night · Borrow candy', bones: 'Trader · Swap costumes and pets', hayley: 'Pumpkin farmer', wisp: 'Riddle master', dj: 'Party starter' };
const NPC_CHIPS = {
  mayor: ['What should I do?', 'How do I get real treats?', 'Tell me a pumpkin pun!', 'Any candy for a hard worker?'],
  hex: ['What potions do you sell?', 'Could I get a discount, dearie?', 'Tell me some gossip!', 'I brought wisps from the woods!'],
  count: ['Could I borrow some candy?', 'Your cape is magnificent!', 'What are your terms?', 'Lower interest, please?'],
  bones: ['Whatcha selling?', 'Want to buy my pumpkins?', 'Swap my pumpkins for a pet?', "That's too expensive!"],
  hayley: ['How do I harvest?', 'Why are you scared of crows?', 'Tell me about the festival'],
  wisp: ['Give me a riddle!', 'Can I have a hint?', 'Teach me something about AI'],
  dj: ['Drop a beat!', 'How do I start a party?', 'What song is this?'],
};

export class UI {
  constructor() {
    this.handlers = {};
    this.dialogNpc = null;
    this.toastCount = 0;
    // closed by default; it remembers if a player opens it
    this.questsOpen = localStorage.getItem('hh-quests') === 'open';
    hydrateIcons();
    if (!matchMedia('(pointer: coarse)').matches) document.body.classList.add('desktop');
    // The HUD is drawn for a big laptop screen and scaled down (CSS zoom: var(--ui)) on smaller ones, so a tablet
    // keeps more of the game visible; touch targets stay at least ~44 px.
    const fit = () => document.documentElement.style.setProperty('--ui', Math.max(0.72, Math.min(1, innerWidth / 1500, innerHeight / 980)).toFixed(3));
    fit();
    addEventListener('resize', fit);
    $('#modal .x').onclick = () => this.closeModal();
    $('#modal').addEventListener('pointerdown', (e) => {
      if (e.target.id === 'modal') this.closeModal();
    });
    $('#dialog .x').onclick = () => this.closeDialog();
    // hold-to-talk: speech -> text on the server (Freesia), then it is sent like a typed line
    this.voiceToken = '';
    const micLabel = (t) => ($('#dialog .mic .lb').textContent = t);
    this.voice = new VoiceTalk($('#dialog .mic'), {
      getToken: () => this.voiceToken,
      onText: (text) => this.dialogNpc && this.handlers.talk?.(this.dialogNpc, text),
      toast: (msg) => this.toast(msg),
      onState: (st) => (st === 'listening' && this.handlers.listening?.(), micLabel(st === 'listening' ? 'Listening… let go to send' : st === 'sending' ? 'Understanding…' : 'Hold to talk')),
    });
    $('#dialog .kbd').onclick = () => this.setTyping(!this.typing, true);
    $('#dialog form').onsubmit = (e) => {
      e.preventDefault();
      const input = $('#dialog input');
      const text = input.value.trim();
      if (text && this.dialogNpc) this.handlers.talk?.(this.dialogNpc, text);
      input.value = '';
    };
    $('#chat-form').onsubmit = (e) => {
      e.preventDefault();
      const text = $('#chat-input').value.trim();
      if (text) this.handlers.chat?.(text);
      $('#chat-input').value = '';
      this.closeChat();
    };
    $('#chat-box .quick').innerHTML = QUICK_CHAT.map((q) => `<button>${esc(q)}</button>`).join('');
    $('#chat-box .quick').onclick = (e) => {
      if (e.target.tagName === 'BUTTON') {
        this.handlers.chat?.(e.target.textContent);
        this.closeChat();
      }
    };
    this.buildEmoteWheel();
    // quest cards live both in the HUD panel and in the checklist modal
    const pickQuest = (e) => {
      const c = e.target.closest('.qcard, .qcard-link');
      if (!c) return false;
      if (!c.classList.contains('done')) this.handlers.trackQuest?.(c.dataset.q);
      return true;
    };
    $('#modal').addEventListener('click', pickQuest);
    $('#quest-panel').onclick = (e) => {
      if (pickQuest(e)) return;
      if (e.target.closest('h3')) {
        this.questsOpen = !this.questsOpen;
        localStorage.setItem('hh-quests', this.questsOpen ? 'open' : 'closed');
        $('#quest-panel').classList.toggle('collapsed', !this.questsOpen);
      }
    };
    $('#quest-panel').classList.toggle('collapsed', !this.questsOpen);
  }

  on(name, fn) {
    this.handlers[name] = fn;
  }

  // ---------------------------------------------------------------- login
  showLogin(defaultName, cb) {
    $('#loading').classList.add('hidden');
    $('#login').classList.remove('hidden');
    const input = $('#name-input');
    input.value = defaultName || '';
    const go = () => {
      const n = input.value.trim();
      if (n.length < 2) {
        input.focus();
        input.placeholder = 'At least 2 letters please!';
        return;
      }
      // a hidden input can keep focus, and the game ignores keys while an input has focus
      input.blur();
      $('#login').classList.add('hidden');
      cb(n);
    };
    $('#play-btn').onclick = go;
    input.onkeydown = (e) => {
      if (e.key !== 'Enter') return;
      // stop here, or the game would see this Enter and open the chat box
      e.preventDefault();
      e.stopPropagation();
      go();
    };
    if (!matchMedia('(pointer: coarse)').matches) setTimeout(() => input.focus(), 100);
  }

  hideLoading() {
    $('#loading').classList.add('hidden');
  }
  showHud() {
    $('#hud').classList.remove('hidden');
  }

  // ---------------------------------------------------------------- me / quests
  setMe(me, prev) {
    $('#me-name').textContent = me.name;
    $('#me-title').textContent = me.avatar?.title || '';
    $('#candy').textContent = me.candy;
    const left = me.tickets - (me.redeemed || 0);
    $('#tickets').textContent = left;
    const items = me.items || {};
    $('#revives').textContent = items.revive || 0;
    $('#revive-pill').classList.toggle('hidden', !items.revive);
    $('#fire-pill').classList.toggle('hidden', !items.fire);
    if (prev && (me.clues || []).length > (prev.clues || []).length) $('#story-dot').classList.remove('hidden');
    if (prev && me.candy > prev.candy) this.bump('#candy-pill');
    if (prev && me.tickets > prev.tickets) this.bump('#ticket-pill');
    const banner = $('#booth-banner');
    if (!me.photo) {
      banner.innerHTML = `${icon('camera')}<span>Get your 3D look at the <u>Photo Booth</u>, the pink tent in the plaza!</span><span class="code">Your code <b>${esc(me.code)}</b></span>`;
      banner.classList.remove('hidden');
    } else banner.classList.add('hidden');
    this.renderQuests(me);
  }

  bump(sel) {
    const el = $(sel);
    el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.3)' }, { transform: 'scale(1)' }], { duration: 350 });
  }

  // The checklist: one picture card per quest. Tap a card to track it (the compass and mini-map point at it) and
  // to see where it is on the map.
  renderQuests(me, tracked = this.tracked) {
    this.tracked = tracked;
    this.lastMe = me;
    const done = QUESTS.filter((q) => me.quests[q.id]?.done).length;
    const inRow = done % TICKET_EVERY;
    const maxed = me.tickets >= MAX_TICKETS;
    const meter = maxed
      ? `<div class="ticket-meter full">${icon('ticket')} All ${MAX_TICKETS} Treat Tickets earned!</div>`
      : `<div class="ticket-meter"><span>${icon('ticket')}</span><span class="slots">${Array.from({ length: TICKET_EVERY }, (_, i) => `<i class="${i < inRow ? 'on' : ''}"></i>`).join('')}</span><span>${TICKET_EVERY - inRow} more for a Treat Ticket</span></div>`;
    const card = (q) => {
      const st = me.quests[q.id] || {};
      const n = Math.min(st.n || 0, q.goal || 1);
      const bar = q.goal && !st.done ? `<div class="qbar"><i style="width:${(100 * n) / q.goal}%"></i></div>` : '';
      const right = st.done ? '<span class="qr ok">✓</span>' : `<span class="qr">${q.goal ? `${n}/${q.goal}` : `+${q.reward}`}<small>${q.goal ? '' : '🍬'}</small></span>`;
      return `<button class="qcard ${st.done ? 'done' : ''} ${q.id === tracked && !st.done ? 'tracked' : ''} ${q.group ? 'group' : ''}" data-q="${q.id}">
        <span class="qi">${icon(q.id) || icon('star')}</span>
        <span class="qb"><span class="t">${q.id === tracked && !st.done ? icon('pin', 'inline') : ''}${esc(q.title)}${q.group ? ` <em>${icon('users', 'inline')}group</em>` : ''}</span><span class="h">${esc(q.hint)}</span>${bar}</span>${right}</button>`;
    };
    const open = QUESTS.filter((q) => !me.quests[q.id]?.done);
    const finished = QUESTS.filter((q) => me.quests[q.id]?.done);
    this.questHtml = () => `<p class="q-tip">Tap a quest to see where it is on the map.</p><div class="qgrid">${[...open, ...finished].map(card).join('')}</div>${meter}`;
    // closed: just the quest you are on (tracked, else the next open one)
    const now = open.find((q) => q.id === tracked) || open[0];
    $('#quest-panel').innerHTML = `<h3><span>${icon('scroll')}Checklist <b>${done}/${QUESTS.length}</b></span><span class="chev"><svg viewBox="0 0 24 24"><path d="M6 9 L12 15 L18 9" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg></span></h3>
      <div class="q-now">${now ? card(now) : ''}</div>
      <div class="q-list">${meter}${open.map(card).join('')}${finished.length ? `<div class="more">${icon('check', 'inline')} ${finished.length} done · tap ${icon('scroll', 'inline')} to see them all</div>` : ''}</div>`;
  }

  setHp(hp, max, hit) {
    const f = Math.max(0, hp / max);
    const el = $('#hp');
    el.querySelector('.fill').style.width = `${f * 100}%`;
    el.classList.toggle('low', f < 0.35);
    $('#hp-n').textContent = Math.round(hp);
    if (hit) {
      const fl = $('#hurt-flash');
      fl.classList.remove('on');
      void fl.offsetWidth;
      fl.classList.add('on');
      this.bump('#hp');
    }
  }

  setDown(on, secs) {
    $('#down-veil').classList.toggle('hidden', !on);
    if (on && secs != null) $('#down-secs').textContent = Math.max(0, Math.ceil(secs));
  }

  // Madame Hex's prophecy and the clues found so far.
  journal(me) {
    $('#story-dot').classList.add('hidden');
    const found = new Set(me.clues || []);
    const n = CLUES.filter((c) => found.has(c.id)).length;
    const verdict = n >= CLUES_NEEDED
      ? '<div class="verdict">🎩 You have figured it out… it is <b>MAYOR GOURDON</b>! Stay close to your friends, and be ready when he shows his true face.</div>'
      : `<div class="verdict dim">Find ${CLUES_NEEDED - n} more clue${CLUES_NEEDED - n === 1 ? '' : 's'} to work out who it is.</div>`;
    this.modal(`<div class="story"><h2>📖 The Prophecy</h2>
      <div class="prophecy"><span class="who">${PROPHECY.icon}</span><p>${esc(PROPHECY.text)}<br><small>— ${esc(PROPHECY.from)}</small></p></div>
      <h3>🔍 Clues ${n}/${CLUES.length}</h3>
      <div class="clues">${CLUES.map((c) => {
        const q = QUESTS.find((x) => x.id === c.quest);
        return found.has(c.id)
          ? `<div class="clue"><span>${c.icon}</span><p>${esc(c.text)}</p></div>`
          : `<button class="clue locked qcard-link" data-q="${c.quest}"><span>❔</span><p>Hidden in <b>${esc(q?.title || '')}</b>. Tap to see where.</p></button>`;
      }).join('')}</div>${verdict}</div>`, { wide: true });
  }

  prophecy(onClose) {
    this.modal(`<div class="story intro"><h2>🔮 A Prophecy…</h2>
      <div class="prophecy"><span class="who">🧙‍♀️</span><p>${esc(PROPHECY.text)}<br><small>— ${esc(PROPHECY.from)}</small></p></div>
      <p class="hint">Quests hide clues. Read them anytime in 📖. Get hurt too much and you turn into a pumpkin, so stick with friends and carry Revive Potions 🧪!</p>
      <button class="btn big orange" id="prophecy-ok">I'll be ready 🎃</button></div>`, { onClose });
    $('#prophecy-ok').onclick = () => this.closeModal();
  }

  setOnline(n) {
    $('#online').textContent = n;
  }

  // ---------------------------------------------------------------- toasts, banner, chat
  toast(text, kind = 'info') {
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    const [first, rest] = splitLead(text);
    const lead = first || TOAST_ICON[kind] || 'sparkle';
    el.innerHTML = `<span class="ti">${icon(lead)}</span><span class="tt">${richText(rest)}</span>`;
    const box = $('#toasts');
    box.appendChild(el);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => el.remove(), 5100);
  }

  banner(text) {
    const b = $('#banner');
    const lead = leadIcon(text);
    b.innerHTML = `${lead ? icon(lead, 'bn') : ''}<span>${esc(stripEmoji(text))}</span>`;
    b.classList.remove('show');
    void b.offsetWidth;
    b.classList.add('show');
  }

  chatLine(name, text, sys = false) {
    const el = document.createElement('div');
    el.className = 'line' + (sys ? ' sys' : '');
    el.innerHTML = sys ? richText(text) : `<b>${esc(name)}</b> ${richText(text)}`;
    const log = $('#chat-log');
    log.appendChild(el);
    while (log.children.length > 7) log.firstChild.remove();
    setTimeout(() => el.remove(), 14000);
  }

  openChat() {
    $('#chat-box').classList.remove('hidden');
    this.closeEmotes();
    setTimeout(() => $('#chat-input').focus(), 30);
  }
  closeChat() {
    $('#chat-box').classList.add('hidden');
    $('#chat-input').blur();
  }
  chatOpen() {
    return !$('#chat-box').classList.contains('hidden');
  }

  buildEmoteWheel() {
    const w = $('#emote-wheel');
    w.innerHTML = EMOTES.map((e, i) => `<button data-e="${e.id}">${icon(e.id)}<span>${e.label}</span>${i < 9 ? `<small>${i + 1}</small>` : ''}</button>`).join('') + `<div class="hint">${icon('heart', 'inline')} Heart goes to the nearest player · ${icon('dance', 'inline')} Dance with friends on the dance floor!</div>`;
    w.onclick = (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      this.handlers.emote?.(b.dataset.e);
      this.closeEmotes();
    };
  }
  toggleEmotes() {
    $('#emote-wheel').classList.toggle('hidden');
    this.closeChat();
  }
  closeEmotes() {
    $('#emote-wheel').classList.add('hidden');
  }

  // ---------------------------------------------------------------- prompt + action buttons
  setPrompt(target, touch) {
    // called every frame: only touch the DOM when the target changes
    const key = target ? target.label : '';
    if (key === this.promptKey) return;
    this.promptKey = key;
    const p = $('#prompt');
    const use = $('#act-use');
    if (!target) {
      p.classList.add('hidden');
      use.classList.add('idle');
      use.innerHTML = icon('hand');
      return;
    }
    use.classList.remove('idle');
    const ic = EMOJI_ICON[target.icon] || target.icon || 'hand';
    use.innerHTML = `${icon(ic) || icon('hand')}<span class="lbl">${esc(target.short || 'Use')}</span>`;
    if (touch) {
      p.classList.add('hidden');
      return;
    }
    p.innerHTML = `<kbd>E</kbd>${icon(ic) || ''}<span>${esc(target.label)}</span>`;
    p.classList.remove('hidden');
  }

  // Arrow toward the next open quest, relative to where the camera looks.
  setCompass(info) {
    const c = $('#compass');
    if (!info) {
      c.classList.add('hidden');
      return;
    }
    c.classList.remove('hidden');
    const label = `${info.title} · ${info.dist} m`;
    if (label !== this.compassLabel) {
      this.compassLabel = label;
      c.querySelector('.t').textContent = label;
    }
    c.querySelector('.arrow').style.transform = `rotate(${info.angle}rad)`;
  }

  setAttack(on) {
    $('#act-attack').classList.toggle('hidden', !on);
  }

  bossBar(state, name = '👑🎃 The Gourd King') {
    const bar = $('#boss-bar');
    bar.querySelector('.boss-name').innerHTML = `${icon(leadIcon(name) || 'crown')}<span>${esc(stripEmoji(name))}</span>`;
    const active = ['intro', 'fight', 'shield', 'stunned'].includes(state.state);
    bar.classList.toggle('hidden', !active);
    if (!active) return;
    bar.classList.toggle('shield', state.state === 'shield');
    bar.querySelector('.fill').style.width = `${(100 * state.hp) / Math.max(1, state.maxHp)}%`;
    const lit = (state.braziers || []).filter(Boolean).length;
    bar.querySelector('.boss-sub').textContent =
      state.state === 'intro' ? (state.b === 'mayor' ? 'Mayor Gourdon shows his true face!' : 'The Gourd King awakens!') :
      state.state === 'shield' ? `🛡️ Shielded! Light braziers together: ${lit}/${state.need}` :
      state.state === 'stunned' ? '💫 Dizzy! Double damage!' :
      `${state.fighters} fighter${state.fighters === 1 ? '' : 's'} · Throw candy (🍬 button / R) · Jump over shockwaves!`;
  }

  activity(text) {
    const a = $('#activity');
    a.classList.toggle('hidden', !text);
    if (text) a.textContent = text;
  }

  // ---------------------------------------------------------------- NPC dialog
  // Talking is voice first: a big hold-to-talk mic. Typing shows only when the mic cannot work here, or on request.
  setTyping(on, remember = false) {
    const canTalk = !$('#dialog .mic').hidden;
    this.typing = on || !canTalk;
    if (remember) localStorage.setItem('hh-typing', this.typing ? '1' : '0');
    $('#dialog .talk').classList.toggle('typing', this.typing);
    $('#dialog form').classList.toggle('hidden', !this.typing);
    $('#dialog .mic').classList.toggle('hidden', this.typing);
    $('#dialog .kbd').classList.toggle('hidden', !canTalk);
    $('#dialog .kbd').innerHTML = icon(this.typing ? 'mic' : 'keyboard');
    $('#dialog .kbd').title = this.typing ? 'Talk with your voice' : 'Type instead';
    const desk = document.body.classList.contains('desktop');
    $('#dialog .talk-hint').textContent = this.typing
      ? (canTalk ? 'Typing mode. Tap 🎙️ to talk with your voice again.' : 'Your browser cannot use the microphone here, so type to talk.')
      : `Hold the mic${desk ? ' (or hold V)' : ''} while you talk, then let go. They answer above their head!`;
    if (this.typing && desk) setTimeout(() => $('#dialog input').focus(), 50);
  }

  openDialog(id, me) {
    this.dialogNpc = id;
    const d = $('#dialog');
    d.classList.remove('hidden');
    document.body.classList.add('talking');
    d.querySelector('.npc-icon').innerHTML = icon(NPC_ICON[id] || 'smile');
    d.querySelector('.npc-name').textContent = NPCS[id].name;
    d.querySelector('.npc-sub').textContent = NPC_SUB[id] || '';
    d.querySelector('.offer').classList.add('hidden');
    this.handlers.npcSays?.(id, NPCS[id].greeting);
    d.querySelector('.chips').innerHTML = (NPC_CHIPS[id] || []).map((c) => `<button>${esc(c)}</button>`).join('');
    d.querySelector('.chips').onclick = (e) => {
      if (e.target.tagName === 'BUTTON') this.handlers.talk?.(id, e.target.textContent);
    };
    this.renderExtras(me);
    this.setTyping(localStorage.getItem('hh-typing') === '1');
  }

  renderExtras(me) {
    const id = this.dialogNpc;
    if (!id) return;
    const ex = $('#dialog .extras');
    const parts = [];
    if (id === 'count' && me.debt) parts.push(`<button class="btn gold" data-x="repay">🦇 Repay ${me.debt.due} 🍬</button>`);
    if (id === 'mayor') {
      parts.push(`<button class="btn gold" data-x="buyTicket">🎟️ Buy a Treat Ticket (${TICKET_CANDY_PRICE} 🍬)</button>`);
      parts.push(`<button class="btn" data-x="tickets">My tickets</button>`);
    }
    if (id === 'bones') parts.push(`<span class="pill">🎃 ${me.pumpkins} · 🫙 ${me.wisps}</span>`);
    if (id === 'hex') parts.push(`<button class="btn teal" data-x="buyRevive">🧪 Buy a Revive Potion (20 🍬)</button><button class="btn purple" data-x="changeClass">✨ Change class</button><span class="pill">🧪 ${me.items?.revive || 0}</span>`);
    ex.innerHTML = iconize(parts.join(''));
    ex.onclick = (e) => {
      const b = e.target.closest('[data-x]');
      if (b) this.handlers[b.dataset.x]?.();
    };
  }

  closeDialog() {
    $('#dialog').classList.add('hidden');
    document.body.classList.remove('talking');
    $('#dialog input').blur();
    this.voice.release();
    this.dialogNpc = null;
    this.handlers.dialogClosed?.();
  }


  showOffer(offer, candy) {
    const o = $('#dialog .offer');
    if (!offer) {
      o.classList.add('hidden');
      return;
    }
    const short = offer.price > candy;
    o.innerHTML = `<span>${icon('deal')}${richText(splitLead(offer.label)[1])}</span><button class="btn teal" ${short ? 'disabled' : ''}>${short ? `Need ${offer.price} ${icon('candy', 'inline')}` : 'Accept'}</button>`;
    o.classList.remove('hidden');
    o.querySelector('button').onclick = () => {
      this.handlers.accept?.();
      o.classList.add('hidden');
    };
  }

  // ---------------------------------------------------------------- modals
  modal(html, { onClose, wide } = {}) {
    const m = $('#modal');
    m.querySelector('.modal-body').innerHTML = iconize(html);
    m.querySelector('.modal-card').style.maxWidth = wide ? 'min(96vw, 900px)' : '';
    m.classList.remove('hidden');
    this.onModalClose = onClose;
    return m.querySelector('.modal-body');
  }
  closeModal() {
    $('#modal').classList.add('hidden');
    const f = this.onModalClose;
    this.onModalClose = null;
    f?.();
  }
  modalOpen() {
    return !$('#modal').classList.contains('hidden');
  }

  tickets(me) {
    const left = me.tickets - (me.redeemed || 0);
    const done = QUESTS.filter((q) => me.quests[q.id]?.done).length;
    this.modal(`<h2>🎟️ Treat Tickets</h2>
      ${left > 0 ? `<div class="ticket"><div>Show this at the treat table</div><div class="code">${esc(me.code)}</div><div class="left">${left} treat${left > 1 ? 's' : ''} waiting · ${esc(me.name)}</div></div>` : `<p>No tickets to redeem yet. Every <b>${TICKET_EVERY} quests</b> earn one (you've done ${done}), beating the Gourd King gives one more, and Mayor Gourdon sells them for ${TICKET_CANDY_PRICE} candy.</p>`}
      <p style="text-align:center">Earned ${me.tickets} · Redeemed ${me.redeemed || 0} · Max ${MAX_TICKETS} per player</p>`);
  }

  help(touch) {
    this.modal(`<h2>❔ How to play</h2><div class="help-grid">
      <div><h4>🕹️ Move</h4>${touch ? 'Drag on the left side to walk. Drag on the right side to look around. Pinch to zoom.' : '<kbd>WASD</kbd> or arrows to run, <kbd>Shift</kbd> to walk, drag the mouse to look, scroll to zoom.'}</div>
      <div><h4>✋ Interact</h4>${touch ? 'Tap the orange button' : 'Press <kbd>E</kbd>'} near people and things: talk, pick, catch, light, brew, carve.</div>
      <div><h4>💬 Talk to the locals</h4>The townsfolk are AI! Chat with them, haggle with Bones and Madame Hex, and sweet-talk Count Snackula into a loan.</div>
      <div><h4>📜 Quests → 🍬 Real treats</h4>Every ${TICKET_EVERY} quests give a Treat Ticket. Show your ticket code at the club table for real candy!</div>
      <div><h4>👥 Together</h4>Group quests: the Summoning Circle, the Monster Mash dance floor and the Gourd King boss in the Moonlit Courtyard.</div>
      <div><h4>😄 Be silly</h4>${touch ? 'Tap 😄' : 'Press <kbd>Q</kbd> or <kbd>1</kbd>-<kbd>9</kbd>'} for emotes. Send hearts, dance, scare people with Boo!</div>
      </div><p style="text-align:center">📸 Step into the <b>Photo Booth</b> (the pink tent in Lantern Plaza, 📸 on the map) to turn your photo into your own 3D character!</p>`, { wide: true });
  }
}

export { esc };
