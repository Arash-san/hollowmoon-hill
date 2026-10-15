# Hollowmoon Hill

The LLM Engineering Club Halloween game. It is a cozy 3D multiplayer town in the browser, built for tablets and laptops (touch and keyboard).

## Run it

```powershell
powershell -ExecutionPolicy Bypass -File tools\start.ps1   # Ollama on GPU 1 (:11445), Kokoro voices (:8834), game server (:8830)
```

It picks the RTX 5090 with the most free memory (set `HH_GPU=<nvidia-smi index>` to choose) and keeps Ollama on CUDA only. The scheduled task "Hollowmoon Hill" runs it at logon; `tools\install-boot-task.ps1` (one UAC prompt) makes it also run at boot, before anyone signs in.

First time setup on a new machine:

```powershell
npm install
node tools/build.js
ollama pull qwen3:8b; ollama pull qwen3-vl:8b-instruct
# NPC voices (optional; without them NPCs only show talk bubbles)
cd tts; python -m venv .venv; .venv\Scripts\pip install -r requirements.txt
# then put kokoro-v1.0.onnx and voices-v1.0.bin from github.com/thewh1teagle/kokoro-onnx/releases in tts\models\
```

`data/` (keys, the Freesia token, saved state) and the Kokoro models are not in git.

- Players: `http://yorhapc:8830` on the tailnet, or `http://localhost:8830` on this PC.
- Officers: `https://llmclub.inquirelab.ai/halloween/` (the "Play now" card on the officer portal Home). nginx on the VPS proxies it to this PC over Tailscale, and only lets in a signed-in officer (see `/etc/nginx/snippets/llmclub-halloween.conf`). It is https, so the microphone and the booth's live camera work there.
- Photo booth: `/booth.html?key=<booth key>`.
- Treat table: `/admin.html?key=<admin key>`.
- Game Master: `/gm.html?key=<admin key>`. Start or schedule events (Gourd King, dance party, spider swarm, the finale), announce, and slow down, block or mute a player for a few minutes.
- Room speaker: `/speaker.html?key=<admin key>` on the PC plugged into the room speaker. It reads announcements and big moments out loud.

Both keys are in `data/keys.json`. Give the booth key only to the officers running the camera, and the admin key only to the treat table.

To rebuild the client after editing: `node tools/build.js` (or `--dev`). To restart the server: `tools/restart.sh`.

## How it works

- **Server** (`server/`): Node with `ws`. It owns everything that pays out, which is candy, quests, Treat Tickets and NPC deals. It also runs the boss (health and attack timing), the ritual and the dance party. Movement comes from the clients and is relayed 10 times a second. State is saved in `data/state.json`.
- **Photo to avatar** (`server/avatarAgent.js`):
  - Qwen3-VL 8B looks at the booth photo. It picks the hair style, clothes, glasses, a Halloween costume piece, a pet and a kind nickname, and it outlines the face, hair and shirt.
  - The server then measures the skin, hair and shirt colours from the photo pixels inside those outlines.
  - This takes about 1.5 s. The result is an avatar spec (`shared/avatar.js`), and the browser builds a rigged chibi character from it. Because of that, every emote works on every face.
  - Photos are not saved.
- **NPCs** (`server/npc.js`):
  - Qwen3 8B (`qwen3:8b`, Q4_K_M, 8.2B parameters, thinking off) plays 7 characters. On one RTX 5090 it writes about 185 to 205 tokens a second and reads prompts at about 4,400 tokens a second, so a reply takes 0.2 to 0.4 s. `OLLAMA_NUM_PARALLEL=8` lets 8 players talk at the same moment; the rest wait in a short queue.
  - They can propose loans, discounts, item swaps and small gifts. The server clamps every offer to hard limits, and the player has to press Accept.
  - Prompt injection gets an in-character refusal at worst.
- **Voice** (`server/voice.js`, `client/src/voice.js`):
  - Talking to an NPC is voice first: hold the big mic button (or the V key), speak, and let go. Typing (the keyboard button) is the fallback. What you said and what they answer show as talk bubbles over the heads; there is no chat window.
  - The server sends the clip to Freesia Voice (`voice.inquirelab.ai`) with the game's own account `halloween-game`. Its token is in `data/freesia.json`.
  - Recordings are never kept (`contribute=0`). One clip at a time and at most 10 a minute per player, and Freesia allows 40 a minute for the whole account.
  - Browsers allow the microphone only on https or localhost, so the button is hidden on `http://yorhapc:8830`.
- **NPC voices** (`server/tts.js`, `tts/server.py`): Kokoro 82M (kokoro-onnx on the GPU) speaks each reply sentence by sentence, so the first sentence plays while the rest is still being made. A sentence takes 0.15 to 0.35 s. Every NPC has its own voice and speed (`voice` in `shared/world.js`), and the browser shifts the pitch for the goofy ones.
- **Icons** (`client/src/icons.js`): the whole UI uses one set of drawn SVG icons instead of emoji. `richText()` and `iconize()` swap any emoji in server text for the matching icon.
- **Client** (`client/src/`): three.js with toon shading and outlines. Everything is built in code: the characters, the world props, the music and the sound effects. There are no asset files.

## Activities

- **Solo:**
  - pumpkin harvest
  - wisp catching
  - potion brewing (memory and timing)
  - candle vigil (timed)
  - pumpkin carving (the drawing glows in the plaza gallery)
  - riddles (judged by the AI)
  - haggling and loans with NPCs
- **Group:**
  - Summoning Circle (2 to 3 players on the runes)
  - Monster Mash (3 players dancing)
  - the Gourd King boss:
    - Its health scales with the number of fighters.
    - It attacks with shockwaves, seed volleys and minions.
    - Halfway through it raises a shield that players break by lighting braziers together.
- **Rewards:** every 3 quests and a boss win give a Treat Ticket (5 max per student). Mayor Gourdon also sells tickets for 150 candy. Students show their code at the treat table to get real candy.
- **Social:** 12 emotes, hearts, Boo! (it makes nearby players jump), chat with quick phrases, and pets.

## v2 (after the Oct 14 officer meeting)

- **Mini-map** always on (top right, turns with the camera). The tracked quest shows as a gold pin.
- **Checklist cards**: tap a quest to track it and see it on the map.
- **Photo Booth** tent in the plaza (📸 on the maps). On https, players take their own photo there (`POST /api/selfie`, 3 tries each, photo not kept); otherwise they show their code at the camera table.
- **Story**: Madame Hex's prophecy on first join, 6 clues hidden in quests (📖 journal, key J), and the finale "the Mayor's betrayal": Mayor Gourdon rises from the fountain as the Pumpkin King and everyone online fights him. Only officers start it (Game Master page or schedule).
- **Health**: boss hits and spider bites hurt; at zero you turn into a pumpkin (wearing your carving) for 60 s, or until a friend uses a 🧪 Revive Potion (brewed at the cauldron, or 20 candy from Madame Hex).
- **Spiders** roam the dark parts of town (not the plaza or market) and steal candy; throw candy at them to get it back.
- **Fire Charm** from the Summoning: candy throws become fireballs (1.5x damage).
- New quests: Say Cheese!, The Prophecy, Pumpkin Rescue, Save Hollowmoon Hill.
- A test server can run next to the live one: `HH_DATA=data-dev STATIC_DIR=dist-dev PORT=8831 node server/index.js` after `node tools/build.js --out=dist-dev`. `node tools/v2-shots.js [hud checklist map booth journal spiders down finale gm]` screenshots it (`HH_ADMIN=<admin key>` for the finale and gm).

## v3 (the rest of the Oct 14 meeting list)

- **Classes**: Witch (Fireball, 3x damage), Vampire (Bat Dash, heals a little) and Zombie (Groan scares spiders and minions away, 150 health). Players pick one at the start, or the photo booth picks it from the costume. Power button or F.
- **Gloom Manor** (north of town): a team room for 2 to 4 players. Each player sees only part of a colour code, so the team has to talk to step on the plates in the right order. The win gives candy, a Revive Potion and the Moon Potion.
- **The Pumpkin Bear**: pour the Moon Potion on the Summoning Circle to wake it; a boss for the whole server.
- **Duels** in the arena: candy and powers hurt other players there (and only there).
- **Team lantern** (L): your screen glows in your team colour so friends can find you in the room.
- **Carving contest**: an officer starts it from the Game Master page. Everyone gets 60 s to carve a shown design; the score is how closely the carving matches it.
- **Real pumpkin drawings**: the booth (and players on https) can snap a drawing on paper; it becomes a glowing carving in the game (`server/drawing.js`).
- **World**: an island with a wavy coast, hills, a windmill, a watchtower, a chapel, more houses with real detail and much more set dressing. The maps are drawn from the same terrain.

## Contributing

The code is at https://github.com/Arash-san/hollowmoon-hill. Work on a branch and open a pull request. Before a PR, build with `node tools/build.js --out=dist-dev`, run a test server on :8831 (see v2 above) and run `node tools/v3-test.js` against it.

## Test tools

- `node tools/play.js <npc|pumpkins|wisps|potion|carve|boss|map|tablet|dance|ritual>` takes screenshots of the real client.
- `node tools/bots.js <n> <wander|ritual|dance|boss> <secs>` runs fake players.
- `node tools/booth-test.js <photo.jpg>` runs the booth end to end.
- `node tools/voice-test.js [clip.wav] [npc]` talks to an NPC through Chrome's fake microphone. `node tools/keys-test.js` checks keyboard login and movement. Add `HH_COOKIE_FILE=<portal session token file>` (and `BASE=` for the voice test) to run either one through the portal.
- `BASE=http://127.0.0.1:8831/ HH_ADMIN=<admin key> node tools/v3-test.js` plays two players through classes, a duel, Gloom Manor, the Pumpkin Bear, the lantern and the contest.
- `gallery.html` shows a lineup of avatars, and `gallery.html?world=1&cam=x,y,z&at=x,z` shows the world.

## Known limits

- **Ollama:** the machine-wide Ollama (:11434) crashes when it tries to load any new model (seen 2026-10-13). The game therefore uses its own instance pinned to GPU 1.
- **Phones:** they work but have not been tuned. Tablets and laptops are the target.
- **Booth camera:** a live camera needs https or localhost. Over plain http on a tablet, the booth falls back to the 📁 Upload button, which opens the camera app.
