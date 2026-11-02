# SUN UP, SUN DOWN · CodexTwi

A playable short chapter about Ethan, his handheld console and a distant friend. Read the original conversation, interact in the rainy car, then control the knight while chat votes for a shield or stronger slash. A complete 60-second round leads to results, reflection and replay. Solo play and clearly labeled DEMO voting work without Twitch.

## Run locally

Node.js 22.12+ and npm. From the repository folder:

```text
npm ci --ignore-scripts
npm test
npm run build
npm start
```

Open **http://localhost:3000**. The server binds to 127.0.0.1. Port 3000 must be available. No Gemini/Firebase service or credentials are required for solo/DEMO. Choose Play, pick a graphic look in the real scene preview, and follow the contextual interactions. Do not run a second local server on the same port.

## Controls and flow

Drag to look. The opening car scene is seated; the draft house scenes support WASD movement. E examines a nearby highlighted object. In the console: A/D move, W jumps, S blocks, F slashes. Survive 60 seconds; wins are bonuses, not a six-win gate. Defeat retries after two seconds.

Settings include sensitivity, invert look, brightness, four graphic looks, audio, reduced motion and text size. Settings pause gameplay. A round countdown sits on the handheld. Menu Continue and Back to chapter preserve guided progress while the page remains open; New chapter asks before replacing it. Combat resumes at the ready screen for a fresh round. **Refresh is not a campaign save.**

## Twitch authorization

1. Register a Confidential app, category Game Integration, exact redirect **http://localhost:3000/auth/twitch/callback**.
2. Copy `.env.example` to ignored `.env`; privately set `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET` and channel `vbovu`. Never put credentials in source, screenshots, logs or browser preferences.
3. Restart the backend, open the exact localhost URL, choose Audience setup → Connect Twitch, and authorize `user:read:chat` as the channel owner.
4. LIVE appears only after token validation and an enabled EventSub chat subscription. The button then reads Already connected and is disabled. Tokens stay in backend memory; restart/expiry requires reconnecting. Automatic token refresh is not implemented.
5. During an active 12-second window, a viewer sends `!shield` or `!torch`. First valid vote per viewer wins. Ties/empty windows choose shield. Shield absorbs one hit within eight active seconds; torch increases slash damage from 25 to 35 for eight active seconds. The streamer retains control. Leaving browser focus pauses the game; coordinate a viewer or separate chat device for manual testing.

**Actual live status:** real owner OAuth/EventSub authorization was observed earlier. No real viewer-command-to-gameplay effect has been verified; the owner elected to test that separately. Subsequent backend restart requires reconnecting. DEMO tests and the mocked connected-button UI test are not real Twitch proof. The app reads chat and never posts messages.

## How Codex Was Used

**Actual Codex session ID (Devpost): `01a19c7d-f3ef-7123-afbb-013f8be8d21b`**

Verified against the actual environment and both original/continuation local session_meta records, which share that exact ID. Filename recording suffixes were not substituted. See [session evidence](public-evidence/codex-session.json). Raw private session reasoning and credentials are not published.

Codex implemented the confidential local OAuth/EventSub bridge, deterministic shield/torch voting, consequential knight aid, guided progression, functional settings, graphics preview, coherent camera input, recovery checkpoints, console timer and regression verification on top of the supplied historical game.

Relevant authentic local commits:

| Commit | Contribution |
|---|---|
| `0924574424b20a416cc190b663ac5653c64f940b` | Last verified UX implementation: graphics, camera, recovery, timer |
| `3aa5d8a3e315e98c70dbef8aa2bd8cea6429ca88` | Bedroom completion and clear knight objective |
| `7fe175b` | Stale Twitch reconnect and paused-notification fixes |
| `10c20e5` | Guided chapter, settings and presentation |
| `34a4b1fce9e5ee96848cedc4562febe041ffa7d4` | Honest historical source import; original upstream Git history unavailable |

The full real local history, original hashes and large evidence archives remain preserved locally. This GitHub repository starts with a **lean release snapshot**, so its release commit is distinct from the original implementation SHA. No historical branch was rewritten or force-pushed. [Original commit log](provenance/original-git-history.txt) and [per-file source comparison](provenance/source-manifest.json) explain the relationship. The only product-source transformation for publication removes unverified embedded fonts and uses OS font fallbacks; an unused PNG and raw historical/private material are excluded.

## Verification

37 automated tests passed in the verified working candidate; typecheck/build and full DEMO journey passed. Browser checks covered 1365×768,1920×1080,900×768; original 38-message chat; all 11 bedroom pages; actual 35-damage torch hit; shield protection; pause/focus/replay; graphic/brightness persistence; menu recovery and console countdown. [Curated receipts](public-evidence) contain bounded results. Fresh release install/test/build results are added before push.

Browser verification requires a running backend and Playwright Chromium/FFmpeg (`npx playwright install chromium ffmpeg`). `npm run test:browser` changes local DEMO state: run it against an isolated test server, never an authenticated live game. `BROWSER_EXECUTABLE` selects an installed Chromium; `BASE_URL` selects the isolated server.

## Scope and provenance

Historical story, characters, engine and four draft scenes were supplied by the owner and predate this Codex implementation. Exact pre-competition authoring dates and original upstream history are unknown. This is not completed Part One. No green-wolf/Wren/Princeps expansion was newly added. PHERSU was inspected as a UI reference; no PHERSU product source or assets were imported.

Publication is explicitly authorized by the project owner. This source-only release uses procedural geometry/audio and OS fonts; it includes no downloaded art/music, embedded third-party font binaries or unused historical AI Studio image. Source files retain their existing Apache-2.0 SPDX markers; this statement is not a blanket relicensing of the owner's story/characters. Dependencies retain their licenses and exact versions in package-lock.json. Eligibility involving pre-existing work remains an owner/organizer question.

The original history scan found a Firebase client config key. That config and its historical blobs are **not** in this repository. Firebase describes its service API keys as public project identifiers, but the old key's restrictions were not verified; see [official guidance](https://firebase.google.com/docs/projects/api-keys). No Firebase service is used here.

## Submission status

Source is supplied for judging/reproduction. Public/unlisted YouTube demo URL and completed Devpost submission are not verified. The authentic local DEMO recordings are not a finished submission video or real Twitch proof. Do not claim every part of the historical game was newly created during the competition period.
