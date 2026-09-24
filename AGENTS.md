# SpoTUI — Agent Guide (live branch)

## Source of truth
- Edit `src/*.js` + `user.css` only. Entry: `src/main.js`.
- `theme.js` is a build artifact (gitignored, bundled by CI via
  `npx --yes rollup src/main.js --file theme.js --format iife`). Never edit it
  by hand, never force-add/commit it.

## Local test loop (Spicetify override)
1. Find the Spicetify installation:
   - Windows: `%APPDATA%\spicetify\` (e.g.
     `C:\Users\<you>\AppData\Roaming\spicetify\`)
   - Linux/macOS: `~/.config/spicetify/`
   - Active theme dir on this machine: `Themes/SpoTUI-debug/`
     (contains `theme.js`, `user.css`, `color.ini`, `README.md`).
2. Confirm `config-xpui.ini` has `current_theme = SpoTUI-debug` before testing.
3. Build: `npx --yes rollup src/main.js --file theme.js --format iife`
4. Deploy for testing by copying ONLY these into `Themes/SpoTUI-debug/`:
   - `theme.js` (fresh bundle)
   - `user.css` (only if you changed it)
5. Run `spicetify apply`, restart/reload Spotify, verify. `dev.sh` only
   symlinks `.dev/Themes` + `.dev/Extensions` for Linux-style paths — on
   Windows copy the files instead.

## Preserve rules — do NOT touch
- `config-xpui.ini`: never hand-edit or overwrite. Change settings only via
  `spicetify` CLI / Spotify UI. Reread `current_theme` after `apply`.
- `Themes/SpoTUI-debug/color.ini`: never overwrite during testing unless the
  task is explicitly a scheme change.
- Spotify localStorage `spotui:*` keys (wallpaper, shade, keybinds, actions,
  saved themes, onboarding flags): never clear to "fix" a bug — migrate them.
- `spicetify/Backup/`: never delete.
- `spicetify/Extensions/` (e.g. `lake-bg.js`) and `CustomApps/marketplace`:
  never modify/remove when testing the theme.
- Only ever write inside `Themes/SpoTUI-debug/`; never into `Backup`,
  `Extracted`, or another installed theme.
- Commit scope: `src/`, `user.css`, `color.ini` (intentional only),
  `manifest.json`, `scripts/`, docs. No secrets, no local paths, no user data.
  Before commit, `git diff --stat` must show only intended files (revert any
  debug prints and the rebuilt `theme.js`).

## Hard-won rules (from audits — follow, don't re-learn)
- CSS: triplet vars take comma alpha only —
  `rgba(var(--spotui-accent-rgb, 255, 140, 66), 0.3)`, never the slash form
  (invalid, silently drops the declaration). Never define a var in terms of
  itself (cyclic = guaranteed-invalid). Injected CSS takes `/* */`, never `//`.
- New `spotui:*` key? Classify it (look vs personal vs app-state like
  launched/banner) and handle ALL paths:
  snapshot, apply-wipe, apply-restore, clear/nuke commands, `tui restore`
  backup list. Personal keys (history, keybinds, actions) are excluded everywhere.
- New command or `tui` sub? Mirror it in `KNOWN_COMMANDS`/`KNOWN_TUI_SUBS`
  (history validity), `STATIC_SUGGESTIONS` in `suggest.js` (ghost fill), and
  in all three docs: `help` list, README table, README examples.
- Keys: Chromium swallows `Ctrl+Letter` before the page — only `Alt+Letter`
  (via `tui bind`) and bare keys are bindable. Capture-phase listeners run
  first: open menus own bare keys, modifiers stay global.
- Reverts remove code + docs + tests traces; prove it with grep. Stub-test
  failures need a stack trace before any app code is blamed.
