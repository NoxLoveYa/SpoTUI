<div align="center">
  <table>
    <tr>
      <td>
        <img src="assets/logo.png" alt="SpoTUI Logo" width="200"/>
      </td>
      <td>
        <img src="banner-gif.gif" alt="SpoTUI Banner"/>
      </td>
    </tr>
  </table>

  <h1>SpoTUI</h1>

  <p>
    SpoTUI is a terminal-inspired theme for Spotify that overlays a custom,<br>
    keyboard-driven interface directly inside the Spotify client.<br>
    It is built for <a href="https://spicetify.app/">Spicetify</a>.
  </p>
</div>

![SpoTUI preview](https://img.ge/i/OJuvD46.png)

<table>
  <tr>
    <td align="center" width="50%">
      <img src="https://img.ge/i/aZzwF75.png" alt="Installation">
    </td>
    <td align="center" width="50%">
      <a href="#linux">Linux</a><br><br>
      <a href="#windows">Windows</a><br><br>
      <a href="#marketplace">Marketplace</a>
    </td>
  </tr>
</table>

## Usage

Type `help` in the SpoTUI command bar to see a list of available commands.

| Command | Description |
|---------|-------------|
| `tui -l <on/off>` | Toggle ASCII logo visibility |
| `tui -l -a <on/off>` | Toggle ASCII animation |
| `tui -wp <url> [-o <0-1>] [-fit <cover/contain/fill/none>] [-pos <center/top/bottom/left/right>] [-rich <0-200>]` | Set wallpaper — bare `tui -wp` shows current, flags alone tweak it: opacity, fit, position, richness (100 = default, 0 = off) |
| `tui -t pull <theme_id>` | Apply a theme by its ID (you can find the id on our website) |
| `tui -t <save <name>\|list\|apply <name>\|delete <name>>` | Snapshot the current look locally; list opens the themes menu (Enter applies, Del fills in the delete command); restore/delete snapshots |
| `tui bind "<Letter>" "<command>"` | Binds Alt+`<Letter>` to run a TUI command |
| `tui unbind "<Letter>"` | Remove the Alt+<Letter> keybind |
| `tui bind clear` | Remove all keybinds |
| `tui actions create <name>` | Create a named action |
| `tui actions "<name>" "<listener>" "<command>"` | Bind an action to a listener |
| `tui actions list` | List saved actions |
| `tui actions enable <name>` | Enable an action |
| `tui actions disable <name>` | Disable an action |
| `tui actions delete <name>` | Delete an action |
| `tui -wp off` | Remove wallpaper |
| `tui -shade <#hex\|off>` | Re-tint orange UI to any color (shades preserved); video + posters stay true; bare `tui -shade` shows current |
| `tui -debug <on/off>` | Verbose wallpaper/poster/shade logging for troubleshooting (warnings always print) |
| `tui -posters <on/off>` | Show the wall (pin images first) / hide it, images are kept |
| `tui -posters <shuffle/clear/settings>` | Re-roll posters, spots and sizes / delete everything and switch the wall off / print current settings |
| `tui -posters <add <url> [board]\|count <1-12\|lo-hi>\|density <1-10\|lo-hi>\|theme <#hex>\|opacity <0-1>\|autoshuffle <on/off>\|symmetric <on/off>\|rotate <min/off>>` | Pin an image URL (optional board tag so -pin-clear removes it); visible count (range = random each shuffle); size (range = random per poster); any frame color; layer opacity; fresh layout on every launch; mirrored pairs layout; auto re-roll timer |
| `tui -posters [-o <0-1>] [-c <1-12\|lo-hi>] [-d <1-10\|lo-hi>] [-t <#hex>] [-r <min/off>]` | Flag style, combinable with each other and with on/off: opacity, count, density, frame color, re-roll timer |
| `tui -pin-board <board-url> [token] [-o/-c/-d/-t/-r]` | Sync a board's pins; public boards need no token, private ones do; poster flags apply after sync |
| `tui -pin-boards` / `tui -pin-clear <board>` | Boards menu (Enter re-pulls, Del forgets, A adds) / forget one board (wall switches off if empty) |
| `tui -pin-feed` / `tui -pin-refresh [board] [-o/-c/-d/-t/-r]` / `tui -pin-token <token>` | Random mix from all your boards (needs token) / re-pull boards — or one matching board — to pick up new pins, then recreate the wall (flags apply after) / save API token on this machine only |
| `tui -ly -cp -active <#hex> -inactive <#hex> -near <#hex>` | Set lyrics colors |
| `tui -ly -cp off` | Reset lyrics colors |
| `tui -ly -animation <on/off>` | Toggle lyrics loader animation |
| `tui -bar -bg <#hex> -border <#hex> -text <#hex>` | Set player bar colors |
| `tui -bar -v <on/off>` | Toggle native play bar visibility |
| `tui -bar -c <on/off>` | Toggle custom TUI play bar |
| `tui -bar -c -progress <id>` | Set custom play bar progress style |
| `tui -bar off` | Reset player bar colors |
| `tui -progress -bg <#hex> -fg <#hex>` | Set progress bar colors |
| `tui -progress off` | Reset progress bar colors |
| `tui -inputs -bg <#hex> -bg-hover <#hex> -text <#hex> -border <#hex>` | Set input colors |
| `tui -inputs -buttons <on/off>` | Toggle bottom right buttons visibility |
| `tui -inputs off` | Reset input colors |
| `playlist` / `list` `<playlist-name>` | Open playlist viewer or play a specific playlist |
| `play` / `pause` / `p` | Toggle playback |
| `skip` | Next track |
| `s` / `seek <mm:ss>` | Jump to a specific time |
| `v` / `volume <%>` | Set volume (0-100) |
| `shuffle` | Toggle shuffle |
| `loop` / `superloop` | Toggle repeat mode |
| `lyrics` | Toggle lyrics panel |
| `dj` | Play the DJ playlist |
| `echo <text>` | Display a message |
| `search <query>` | Search Spotify |
| `theme` | Browse and apply themes |
| `discord` | Show the Discord update banner and re-enable it on boot |
| `standby` | Enter standby mode (any key to exit) |
| `help` | Show the help panel |

## Poster wall (Pinterest mode)

Polaroid-style prints pinned on top of the video wallpaper, around the
edges so the terminal stays readable. Layer order: wallpaper < posters < UI.

```bash
tui -posters add https://i.pinimg.com/736x/....jpg
tui -posters on
tui -posters shuffle
tui -posters count 6
tui -posters count 3-6  # random visible number in that range, re-rolled each shuffle
tui -posters density 7    # bigger prints; 3 = subtle, 10 = full wall
tui -posters density 3-8  # each poster rolls its own size in that range
tui -posters symmetric on  # mirrored left/right pairs share sizes
tui -posters rotate 10   # new random picks every 10 min, off to disable
tui -posters clear       # forget all pinned images
tui -pin-boards          # what came from which board
tui -pin-clear someuser/someboard   # forget one board only
tui -pin-refresh         # re-pull synced boards, recreate the wall with current ranges
tui -pin-refresh posters # re-pull only boards matching "posters" (picks up pins added later)
```

Sync straight from Pinterest (video pins resolve to their cover still):

```bash
tui -pin-board pinterest.com/<you>/<board>/   # public boards need no login
tui -pin-token <token>   # developers.pinterest.com, scopes boards:read pins:read
tui -pin-feed            # random mix across all your boards
```

Notes: video wallpaper wants `.webm` (VP9, e.g. Spotify's own `shimmer.webm`
format) — `.mp4`/H.264 is blocked in some Spotify builds, `file://` URLs are
often blocked, so same-origin `https://xpui.app.spotify.com/videos/...` or any
`https://` link works best. Image URLs with spaces must be `%20`-encoded.
The token never leaves your machine (localStorage only). Something
misbehaving? `tui -debug on`, reproduce, and read the `[SpoTUI-*]` console
lines.

## UI shade

SpoTUI's orange re-tinted to any color — one hue rotation, so every shade
step survives. Video wallpaper and posters are counter-rotated to true colors.

```bash
tui -shade #7fd4d4   # cyan UI, video + posters untouched
tui -shade off       # back to orange
```

## Saved themes

Snapshot everything the wall looks like right now — wallpaper, posters,
shade, colors, counts — and restore it later. Works like a restart:
appearance comes back live, no relaunch needed.

```bash
tui -t save cozy      # snapshot current look as cozy
tui -t list           # browse saved themes (Enter applies, Del fills in the delete command)
tui -t apply cozy     # restore it, live
tui -t delete cozy    # forget it
```

## Action Targets

Actions run a command when a listener fires. Create one, then bind it:

```bash
tui actions create autolyrics
tui actions "autolyrics" "actions:spotui@pane_close>!lyrics" "lyrics on"
```

| Target | Description |
|--------|-------------|
| `actions:spotui@pane_close` | Fires when any pane closes |
| `actions:spotui@pane_close>help` | Fires when the help pane closes |
| `actions:spotui@pane_close>about` | Fires when the about pane closes |
| `actions:spotui@pane_close>playlist` | Fires when the playlist pane closes |
| `actions:spotui@pane_close>theme` | Fires when the theme pane closes |
| `actions:spotui@pane_close>lyrics` | Fires when the lyrics pane closes |
| `actions:spotui@pane_close>search` | Fires when the search pane closes |
| `actions:spotui@pane_close>!<pane>` | Fires when any pane except `<pane>` closes |
| `actions:spotui@pane_close><pane> \| spotui@pane_close><pane>` | Fires when any listed pane closes |
| `actions:spotui@pane_close>!<pane> \| spotui@pane_close>!<pane>` | Fires when the closed pane is none of the listed panes |

## Custom Play Bar Progress Styles

When the native Spotify play bar is hidden (`tui -bar -v off`), you can enable a custom, text-based TUI play bar (`tui -bar -c on`). This bar has a progress indicator with 14 different style presets.

To set a progress style, use the command: `tui -bar -c -progress <id>`

### Available Styles

| ID | Preview Example | Description |
|----|-----------------|-------------|
| `classic-block` | `████████░░░░░░░░` | Classic TUI block progress |
| `dark-block` | `▓▓▓▓▓▓▓▓░░░░░░░░` | Dark block progress |
| `gradient` | `██████▓▓▒▒░░░░░░` | Smooth block gradient |
| `thin` | `━━━━━━━━░░░░░░░░` | Bold thin line with empty blocks |
| `line` | `━━━━━━━━────────` | Smooth heavy and light line indicator |
| `square` | `■■■■■■■■□□□□□□□□` | Square bullet style |
| `circle` | `●●●●●●●●○○○○○○○○` | Circular bullet style |
| `diamond` | `◆◆◆◆◆◆◆◆◇◇◇◇◇◇◇◇` | Diamond bullet style |
| `chevron` | `>>>>>>>>░░░░░░░░` | Arrow / Chevron progress |
| `triangle` | `▶▶▶▶▶▶▶▶▷▷▷▷▷▷▷▷` | Solid and empty play-button triangles |
| `braille` | `⣿⣿⣿⣿⣿⣿⣿⣿⣀⣀⣀⣀⣀⣀⣀⣀` | Braille dot block progress |
| `retro` | `▰▰▰▰▰▰▰▰▱▱▱▱▱▱▱▱` | Retro segment blocks |
| `pixel` | `█▀█▀█▀█▀░░░░░░░░` | Checkerboard pixel progress |
| `dashed` | `━━━━━━━╸────────` | Dashed track with end handle |

## Bundling from Source

The theme's JavaScript lives as ES modules in `src/` and must be bundled into a single `theme.js` before it can be loaded by Spicetify.

From the theme root, run:

```bash
npx rollup src/main.js --file theme.js --format iife
```

This bundles `src/main.js` and outputs `theme.js` in the theme root (next to `manifest.json` and `user.css`).

## Contributing

You can add your own theme to the theme browser by visiting [spotui.root.sx](https://spotui.root.sx/).

**Note:** To help prevent broken themes and spam, you must sign in with GitHub to submit a theme.

**Note:** Do not commit the bundled `theme.js`. All PRs with the bundled JS will be closed.

---

<details>
  <summary>Stonks</summary>
  
[![Star History Chart](https://api.star-history.com/chart?repos=skensmaster/spotui&type=date&legend=bottom-right)](https://www.star-history.com/?repos=skensmaster%2Fspotui&type=date&legend=top-right)

</details>

---

<div align="center">

## Author

SkenS - https://github.com/SkenSMasteR

</div>

<div align="center">
  <img src="https://img.ge/i/tYsJn12.png" alt="End of file" width="45%" height="400px">
  <img src="https://img.ge/i/tYsJn12.png" alt="End of file" width="45%" height="400px">
</div>

---

<br><br><br><br><br><br><br><br><br><br><br>
<br><br><br><br><br><br><br><br><br><br><br>

<div align="center">
  <img src="https://img.ge/i/J1uPn48.png" alt="Install"/>
</div>

## Linux

<details>
  <summary>Linux</summary>

  <table>
    <tr>
      <td align="center" width="50%">
        <img src="https://img.ge/i/38eEU30.png" alt="Linux Installation" width="100%">
      </td>
      <td width="50%">
        1. Go in the <a href="https://spotui.root.sx/">SpoTUI Docs</a>.<br>
        2. Select <strong>"Getting Started"</strong>.<br>
        3. Follow the guide.
      </td>
    </tr>
  </table>
  > Note: If you are using Spicetify v3, follow the guide in the "spotui@&lt;version&gt;" release.
</details>

## Windows

<details>
  <summary>Windows</summary>

  <table>
    <tr>
      <td align="center" width="50%">
        <img src="https://img.ge/i/MgChs45.png" alt="Windows Installation" width="100%">
      </td>
      <td width="50%">
        1. Go in the <a href="https://spotui.root.sx/">SpoTUI Docs</a>.<br>
        2. Select <strong>"Getting Started"</strong>.<br>
        3. Follow the guide.
      </td>
    </tr>
  </table>
  > Note: If you are using Spicetify v3, follow the guide in the "spotui@&lt;version&gt;" release.
</details>

## Marketplace

<details>
  <summary>Marketplace</summary>

  <table>
    <tr>
      <td align="center" width="50%">
        <img src="https://img.ge/i/xMjX154.png" alt="Marketplace Installation" width="100%">
      </td>
      <td width="50%">
        1. In Spotify, go to the <strong>Spicetify Marketplace</strong>.<br>
        2. Select <strong>"Themes"</strong> and search for <code>SpoTUI</code>.<br>
        3. Install the theme.
      </td>
    </tr>
  </table>
  > Note: If you are using Spicetify v3, follow the guide in the "spotui@&lt;version&gt;" release.
</details>
