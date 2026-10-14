# Hollowmoon Hill

The LLM Engineering Club Halloween game. It is a cozy 3D multiplayer town in the browser, built for tablets and laptops (touch and keyboard).

## Run it

```powershell
powershell -ExecutionPolicy Bypass -File tools\start.ps1   # Ollama on GPU 1 (:11445) + game server (:8830)
```

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
  - Qwen3 8B plays 7 characters.
  - They can propose loans, discounts, item swaps and small gifts. The server clamps every offer to hard limits, and the player has to press Accept.
  - Prompt injection gets an in-character refusal at worst.
- **Voice** (`server/voice.js`, `client/src/voice.js`):
  - In an NPC chat, hold the 🎙️ button (or tap it once to start and again to send) and speak. The text goes to the NPC like a typed line.
  - The server sends the clip to Freesia Voice (`voice.inquirelab.ai`) with the game's own account `halloween-game`. Its token is in `data/freesia.json`.
  - Recordings are never kept (`contribute=0`). One clip at a time and at most 10 a minute per player, and Freesia allows 40 a minute for the whole account.
  - Browsers allow the microphone only on https or localhost, so the button is hidden on `http://yorhapc:8830`.
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

## Test tools

- `node tools/play.js <npc|pumpkins|wisps|potion|carve|boss|map|tablet|dance|ritual>` takes screenshots of the real client.
- `node tools/bots.js <n> <wander|ritual|dance|boss> <secs>` runs fake players.
- `node tools/booth-test.js <photo.jpg>` runs the booth end to end.
- `node tools/voice-test.js [clip.wav] [npc]` talks to an NPC through Chrome's fake microphone. `node tools/keys-test.js` checks keyboard login and movement. Add `HH_COOKIE_FILE=<portal session token file>` (and `BASE=` for the voice test) to run either one through the portal.
- `gallery.html` shows a lineup of avatars, and `gallery.html?world=1&cam=x,y,z&at=x,z` shows the world.

## Known limits

- **Ollama:** the machine-wide Ollama (:11434) crashes when it tries to load any new model (seen 2026-10-13). The game therefore uses its own instance pinned to GPU 1.
- **Phones:** they work but have not been tuned. Tablets and laptops are the target.
- **Booth camera:** a live camera needs https or localhost. Over plain http on a tablet, the booth falls back to the 📁 Upload button, which opens the camera app.
