# EquiStories Shows

A community show platform for [EquiStories](https://pocketcaster.github.io/Equistories-stable-manager/). Anyone can host a stat- and art-judged show; anyone can enter a horse from their own stable. No server, no accounts.

## Host it on GitHub Pages

1. Create a **public** repo (e.g. `equistories-shows`).
2. Upload **`index.html`** to the repository root.
3. **Settings → Pages** → Source: *Deploy from a branch*, Branch: **main**, folder: **/ (root)**.
4. Wait ~1 minute. Your site is at `https://YOURNAME.github.io/equistories-shows/`.

`index.html` must be at the root, spelled exactly that, or Pages shows your README instead of the app.

## Two ways for people to enter

**Codes (no setup).** Entrants open your invite link, attach their horse and art, and get a code to send you. You paste it under *Accept entry*. Works immediately — but you see who sent each code.

**Mailbox (anonymous, built in).** Entrants click **Submit to show** and their entry lands in a shared drop box as a numbered ticket. The host clicks **Load submitted entries** and never sees who sent what until results are published. The mailbox url is compiled into the app (see `DEFAULT_MAILBOX` near the top of the script), so hosts don't configure anything.

To point the app at your *own* mailbox, deploy `mailbox.gs` (steps below) and replace the `DEFAULT_MAILBOX` string in `index.html`. The url is not a secret — it's a public, write-only drop box by design, so it living in the page source costs nothing.

<details><summary>Deploying your own mailbox</summary>

1. [sheets.google.com](https://sheets.google.com) → blank spreadsheet → name it *EquiStories Shows Mailbox*.
2. **Extensions → Apps Script.** Delete the sample. Paste all of **`mailbox.gs`**. Save.
3. **Deploy → New deployment → Web app.** Execute as **Me**; Who has access **Anyone**. Deploy and authorise.
4. Copy the `/exec` url and paste it over the `DEFAULT_MAILBOX` value in `index.html`.

One mailbox serves all your shows — entries are filed by show id.
</details>

## What keeps it fair

- **Stats are never in the entry.** The code carries the horse's *link*; the host's app fetches stats from that horse's own stable. Nobody can enter a number they didn't train for.
- **Tamper flag.** If a horse trains between entering and judging, the entry is marked ⚠.
- **Blind judging.** Judges see art and an entry number — no names, no stables, no stats. The mailbox keeps the *delivery* anonymous too.
- **Races can't be re-rolled.** Results are seeded from the entry list and published with the seed, so anyone can recompute them.

Blind judging removes the halo; it can't hide a signature or a familiar style. Ask entrants for unsigned copies.

## Prize pools (optional, Buxx)

Buxx is **held from the host's own account** on funding and **released to winners** at results. No per-show business accounts; entrants type nothing.

**One-time setup (platform owner):**
1. Make one business account in the bank to act as the escrow vault (e.g. *EquiStories Show Escrow*). Note its `BIZ-` id.
2. Paste `bank-escrow.gs` into your Buxx Bank script, set `ESCROW_BIZ_ID` to that id, wire the three `handleAction` cases shown at the bottom of the file, and redeploy.

**Per show (host):**
1. **Sign in** at the top with your Buxx Bank ID — the same login as the main EquiStories site (same origin, so it's one shared session; if you're already signed in there, you're signed in here).
2. Set per-place Buxx amounts, then hit **Hold** — the buxx moves from your account into escrow.
3. At results, hit **Release** — escrow pays each winner, and anything unspent returns to you.

**Entrants** sign in the same way. Their entry then carries their *verified* bank userId (the bank checked their password), so prizes reach the right account with nothing typed by hand. Not signing in falls back to a manually entered id.

## Notes

- Art links must be **`https://`** — an `http://` image silently won't load on a Pages site.
- Each entrant's stable must be deployed with access **Anyone**, same as public horse profiles.
- After updating `index.html`, hard-refresh (Ctrl/Cmd-Shift-R); Pages caches for a few minutes.

## Files

- `index.html` — the whole app.
- `mailbox.gs` — optional Apps Script for anonymous submission.
- `engine.js` / `test.js` — the scoring engine and its 60 tests (`node test.js`). Mirrored inside `index.html`; kept separate so the logic can be tested outside a browser.
