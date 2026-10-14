// Bubble Trouble: remember Madame Hex's recipe, drop the ingredients in order, then stir in rhythm.
const INGREDIENTS = [
  ['🍄', 'toadstool'], ['🐸', 'frog'], ['🦇', 'bat wing'], ['🕷️', 'spider'], ['🌙', 'moon dust'], ['👁️', 'eyeball'], ['🌶️', 'dragon pepper'], ['🍬', 'candy'],
];

export function potionGame(ui, audio, onDone) {
  const recipe = [];
  while (recipe.length < 4) {
    const i = Math.floor(Math.random() * INGREDIENTS.length);
    if (!recipe.includes(i)) recipe.push(i);
  }
  let step = 0, hearts = 3, stirs = 0, stirScore = 0, phase = 'show', raf = 0, needle = 0, dir = 1, zone = { a: 0.4, w: 0.2 };
  const body = ui.modal(`<div class="mg">
    <h2>Bubble Trouble</h2>
    <p class="status">Memorise Madame Hex's recipe!</p>
    <div class="recipe">${recipe.map((i) => `<span>${INGREDIENTS[i][0]}</span>`).join('')}</div>
    <div class="cauldron">🫕</div>
    <div class="hearts">${'💚'.repeat(hearts)}</div>
    <div class="shelf">${INGREDIENTS.map(([e, n], i) => `<button data-i="${i}" title="${n}">${e}</button>`).join('')}</div>
    <div class="meter hidden"><div class="zone"></div><div class="needle"></div></div>
    <button class="btn big orange stir hidden">Stir! 🥄</button>
  </div>`, { onClose: () => cancelAnimationFrame(raf) });
  const $ = (s) => body.querySelector(s);
  const spans = [...body.querySelectorAll('.recipe span')];
  const status = (t) => ($('.status').textContent = t);
  const bubble = (ch) => {
    const b = document.createElement('div');
    b.className = 'bub';
    b.textContent = ch;
    $('.cauldron').appendChild(b);
    setTimeout(() => b.remove(), 1000);
  };

  // show the recipe for a moment, then hide it
  setTimeout(() => {
    if (phase !== 'show') return;
    phase = 'add';
    spans.forEach((s) => (s.textContent = '❔'));
    spans[0].classList.add('next');
    status('Now add them in the same order!');
  }, 3200);

  $('.shelf').onclick = (e) => {
    const b = e.target.closest('button');
    if (!b || phase !== 'add') return;
    const i = Number(b.dataset.i);
    if (i === recipe[step]) {
      audio.play('pop');
      spans[step].textContent = INGREDIENTS[i][0];
      spans[step].classList.remove('next');
      spans[step].classList.add('ok');
      bubble(INGREDIENTS[i][0]);
      step++;
      if (step < recipe.length) spans[step].classList.add('next');
      else startStir();
    } else {
      audio.play('wrong');
      b.classList.remove('wrong');
      void b.offsetWidth;
      b.classList.add('wrong');
      bubble('💨');
      hearts--;
      $('.hearts').textContent = '💚'.repeat(Math.max(0, hearts)) + '🖤'.repeat(3 - Math.max(0, hearts));
      if (hearts <= 0) {
        // peek at the recipe again instead of failing outright
        hearts = 3;
        $('.hearts').textContent = '💚💚💚';
        status('Oops, it fizzled! Peek at the recipe again…');
        spans.forEach((s, k) => k >= step && (s.textContent = INGREDIENTS[recipe[k]][0]));
        phase = 'show';
        setTimeout(() => {
          phase = 'add';
          spans.forEach((s, k) => k >= step && (s.textContent = '❔'));
          status('Keep going!');
        }, 2200);
      }
    }
  };

  function startStir() {
    phase = 'stir';
    $('.shelf').classList.add('hidden');
    $('.meter').classList.remove('hidden');
    $('.stir').classList.remove('hidden');
    status('Stir when the needle is in the green! (3 times)');
    newZone();
    let last = performance.now();
    const tick = (now) => {
      const dt = (now - last) / 1000;
      last = now;
      needle += dir * dt * (0.75 + stirs * 0.25);
      if (needle > 1) (needle = 1), (dir = -1);
      if (needle < 0) (needle = 0), (dir = 1);
      $('.needle').style.left = `calc(${needle * 100}% - 4px)`;
      if (phase === 'stir') raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }
  function newZone() {
    zone = { a: 0.1 + Math.random() * 0.65, w: 0.22 - stirs * 0.04 };
    $('.zone').style.left = `${zone.a * 100}%`;
    $('.zone').style.width = `${zone.w * 100}%`;
  }
  const stir = () => {
    if (phase !== 'stir') return;
    const inZone = needle >= zone.a && needle <= zone.a + zone.w;
    stirs++;
    if (inZone) {
      stirScore++;
      audio.play('pickup');
      bubble('✨');
    } else {
      audio.play('wrong');
      bubble('💨');
    }
    if (stirs >= 3) finish();
    else newZone();
  };
  $('.stir').onclick = stir;
  const key = (e) => {
    if (e.key === ' ' && phase === 'stir') {
      e.preventDefault();
      stir();
    }
  };
  addEventListener('keydown', key);

  function finish() {
    phase = 'done';
    cancelAnimationFrame(raf);
    removeEventListener('keydown', key);
    audio.play('brew');
    const score = 2 + stirScore; // 2..5
    $('.meter').classList.add('hidden');
    $('.stir').classList.add('hidden');
    $('.cauldron').textContent = '🧪';
    status(score >= 5 ? 'A PERFECT potion! Madame Hex cackles with joy!' : score >= 4 ? 'A lovely bubbly potion!' : 'It smells… interesting. Still counts!');
    const done = document.createElement('button');
    done.className = 'btn big teal';
    done.textContent = 'Drink it! 🧪';
    body.querySelector('.mg').appendChild(done);
    done.onclick = () => {
      ui.closeModal();
      onDone(score);
    };
  }
}
