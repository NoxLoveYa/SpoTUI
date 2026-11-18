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

<p align="center">
  <a href="https://ko-fi.com/skens">
    <img src="https://img.shields.io/badge/Support-SpoTUI-ff8c42?style=for-the-badge&logo=ko-fi&logoColor=white&labelColor=101010" alt="Support SpoTUI on Ko-fi">
  </a>
</p>

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
| `tui -t pull <theme_id> [-live]` | Apply a theme by its ID from the stable feed, or the live feed with `-live` (you can find the id on our website) |
| `tui -t <save <name>\|list\|apply <name>\|delete <name>>` | Snapshot the current look locally (incl. poster wall layout); list opens the themes menu (Enter applies, Del/D fills in the delete command); restore/delete snapshots |
| `tui bind "<Letter>" "<command>"` | Binds Alt+`<Letter>` to run a TUI command (e.g. `tui bind "T" "tui -t list"` opens the themes menu on `Alt+T`; `Ctrl` combos never reach the page) |
| `tui unbind "<Letter>"` | Remove the Alt+<Letter> keybind |
| `tui bind clear` | Remove all keybinds |
| `Ctrl+R` | Reverse-search persistent command history (typing filters, `Ctrl+R` cycles older matches, `Enter` fills the bar, `Esc` aborts; unknown commands stay session-only) |
| `Tab` | Accept the ghost fill suggestion in the command bar (repeat to cycle matches); also completes the last word of any known command, e.g. `tui -viz -ga` + `Tab` → `tui -viz -gap` |
| `Esc` | Abort history search, or leave the command bar so Spotify gets its keys back |
| `tui actions create <name>` | Create a named action |
| `tui actions "<name>" "<listener>" "<command>"` | Bind an action to a listener |
| `tui actions list` | List saved actions |
| `tui actions enable <name>` | Enable an action |
| `tui actions disable <name>` | Disable an action |
| `tui actions delete <name>` | Delete an action |
| `tui -wp off` | Remove wallpaper |
| `tui -shade <#hex\|off>` | Set the UI accent to any hex color (exact hue, saturation, lightness — even gray/white/black); video + posters stay true; bare `tui -shade` shows current |
| `tui -video <on/off/toggle>` | Video mode: while a song plays, its Spotify Canvas (the short looping clip) replaces your background; paused, stopped, ads, podcasts or songs without a Canvas bring your wallpaper/posters back. Off by default, saved with your look; bare `tui -video` shows what it is doing |
| `tui -debug <on/off>` | Verbose wallpaper/poster/shade logging for troubleshooting (warnings always print) |
| `tui -posters <on/off>` | Show the wall (pin images first) / hide it, images are kept |
| `tui -posters <shuffle/clear/settings>` | Re-roll posters, spots and sizes / delete everything and switch the wall off / print current settings |
| `tui -posters <add <url> [board]\|count <1-12\|lo-hi>\|density <1-10\|lo-hi>\|theme <#hex>\|opacity <0-1>\|autoshuffle <on/off>\|symmetric <on/off>\|rotate <min/off>>` | Pin an image URL (optional board tag so -pin-clear removes it); visible count (range = random each shuffle); size (range = random per poster); any frame color; layer opacity; fresh layout on every launch; mirrored pairs layout; auto re-roll timer |
| `tui -posters [-o <0-1>] [-c <1-12\|lo-hi>] [-d <1-10\|lo-hi>] [-t <#hex>] [-r <min/off>]` | Flag style, combinable with each other and with on/off: opacity, count, density, frame color, re-roll timer |
| `tui -pin-board <board-url> [token] [-o/-c/-d/-t/-r]` | Sync a board's pins; public boards need no token, private ones do; poster flags apply after sync |
| `tui -pin-boards` / `tui -pin-clear <board>` | Boards menu (Enter re-pulls, Del/D forgets, A adds) / forget one board (wall switches off if empty) |
| `tui -pin-feed` / `tui -pin-refresh [board] [-o/-c/-d/-t/-r]` / `tui -pin-token <token>` | Random mix from all your boards (needs token) / re-pull boards — or one matching board — to pick up new pins, then recreate the wall (flags apply after) / save API token on this machine only |
| `tui -ly -cp -active <#hex> -inactive <#hex> -near <#hex>` | Set lyrics colors |
| `tui -ly -cp off` | Reset lyrics colors |
| `tui -ly -animation <on/off>` | Toggle lyrics loader animation |
| `tui -ly -spacing <value>` | Controls vertical spacing between lines in lyrics |
| `tui -ly -spacing off` | Resets line spacing in lyrics |
| `tui -viz -color <#hex>` | Set visualizer bar color |
| `tui -viz -gap <px>` | Set gap between visualizer bars (0 = touching) |
| `tui -viz -gap off` | Reset visualizer bar gap |
| `tui -viz -bars <count>` | Set how many visualizer bars to show |
| `tui -viz -bars off` | Reset visualizer bar count |
| `tui -viz -smooth <1-100>` | Set visualizer bar smoothing |
| `tui -viz -smooth off` | Reset visualizer bar smoothing |
| `tui -viz -mode <adaptive/global>` | Set visualizer reaction mode |
| `tui -viz -mode off` | Reset visualizer reaction mode |
| `tui -viz off` | Reset visualizer bar color |
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
| `tui -panel -bg <#hex> -border <#hex> -text <#hex>` | Set help/playlist/theme/about panel colors |
| `tui -panel off` | Reset panel colors |
| `tui restore [-full]` | Reset SpoTUI's own settings to defaults and reload (keeps history, keybinds, actions, your pin token, saved themes and the onboarding and banner flags; `-full` removes every SpoTUI setting stored in Spotify). Only `spotui:*` keys are touched: Spotify's own settings and other extensions' data stay as they are |
| `playlist` / `list` `<playlist-name>` | Open playlist viewer or play a specific playlist |
| `add2list` | Add the current song to a playlist |
| `queue` | View and reorder the play queue |
| `play` / `pause` / `p` | Toggle playback |
| `skip` | Next track |
| `back` | Previous track |
| `s` / `seek <mm:ss>` | Jump to a specific time |
| `v` / `volume <%>` | Set volume (0-100) |
| `shuffle` | Toggle shuffle |
| `loop` / `superloop` | Toggle repeat mode |
| `like` | Like/unlike current song |
| `lyrics` | Toggle lyrics panel |
| `visualizer` | Toggle audio visualizer (needs [SpoSync](#sposync)) |
| `dj` | Play the DJ playlist |
| `echo <text>` | Display a message |
| `search <query>` | Search Spotify (on a highlighted result: `Enter` plays, `a` adds it to a playlist, `q` adds it to the queue) |
| `about` | Show about panel |
| `theme` | Browse and apply themes |
| `discord` | Show the Discord update banner and re-enable it on boot |
| `standby` | Enter standby mode (any key to exit) |
| `jam create` | Start a listening jam and get a PIN |
| `jam join <pin>` | Join a jam by PIN (volume/lyrics only) |
| `jam leave` | Leave the current jam |
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

SpoTUI's orange accent re-pointed at any hex color — exact hue, saturation,
and lightness, even gray/white/black. Selected rows flip their text
(black/white) automatically so they stay readable. Video wallpaper and
posters never go through the accent path, so they stay true.

```bash
tui -shade #7fd4d4   # cyan UI, video + posters untouched
tui -shade #111111   # near-black UI, selected rows flip to white text
tui -shade off       # back to orange
```

## Video mode

While a song plays, its Spotify Canvas — the short looping clip artists add
to a song — replaces your background. Pause, stop, an ad, a podcast, a local
file or a song without a Canvas brings your wallpaper and posters back.

It works in both modes. In TUI mode the clip replaces the wallpaper and the
posters. In Spotify mode ("Enable Spotify"), where the page is plain black, the
clip plays behind the native UI: the main view turns transparent, the side
panels translucent, and the clip is dimmer so text stays readable. Cards, the
top bar and the player bar stay solid. It pauses
while the window is minimised or fully covered, and in standby.

```bash
tui -video on                      # turn it on (saved with your look and in tui -t save)
tui -video                         # what it is doing right now
tui -video off                     # back to your own background
tui bind "V" "tui -video toggle"   # Alt+V switches it
```

While a clip is showing, the next song's clip is fetched ahead when Spotify
already lists one for it, so the switch is instant. On a slow machine or connection it steps the resolution down, or shows a still
frame instead of the moving clip. With your OS "reduce motion" / animation
setting on, Canvases are shown as stills. If Spotify's clip service keeps
failing, video Canvases pause for 30 minutes (still Canvases keep working).

Limits: Canvas only — full music videos are DRM-protected and cannot play
in a theme. About a third of songs have a Canvas. A Canvas is never cropped:
it plays whole and centred over a blurred album-art backdrop (portrait 9:16
clips leave the most backdrop visible, landscape clips fill more of the
window), dimmed so the terminal stays readable. Everything comes from
Spotify's own servers; a song with a video Canvas costs roughly 0.3-4 MB of
network (more in a bigger window), and nothing runs while video mode is off.

## Saved themes

Snapshot everything the wall looks like right now — wallpaper, posters,
shade, colors, counts — and restore it later. Works like a restart:
appearance comes back live, no relaunch needed.

```bash
tui -t save cozy      # snapshot current look as cozy
tui -t list           # browse saved themes (Enter applies, Del/D fills in the delete command)
tui -t apply cozy     # restore it, live
tui -t delete cozy    # forget it
```

## Queue

`queue` opens the play queue. `Enter` plays the hovered track, `Tab` grabs it
to reorder (arrows move it, `Tab` drops it), `r` removes it, `Esc` closes.

```bash
queue                # open the queue pane (run again to close)
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
| `actions:spotui@pane_close>queue` | Fires when the queue pane closes |
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

## SpoSync

SpoSync is an optional helper program that runs next to Spotify. The theme talks to it over a local WebSocket on `localhost:8765`. It does two things:

- It feeds the audio visualizer (`visualizer`) with live audio from your speakers. The theme cannot read audio by itself.
- It shows a terminal window that mirrors the lyrics, your playlists and search, and lets you type SpoTUI commands.

The theme works without it. Only the `visualizer` command needs it.

> **No prebuilt SpoSync binary is published yet.** Until one is, the installer step needs either **Python 3.12 to 3.15** (it then builds SpoSync from source in a private virtual environment, about 150 MB of downloads and a few minutes), or a SpoSync binary you already have and pass with `-SpoSyncExe` / `--sposync-bin`. The build step only works when you run the installer from a clone of this repository, not through a one-line download: a one-line download has no source to build, so it needs the binary.

### Privacy

- SpoSync listens on `localhost` only. It accepts only Spotify's page (`https://xpui.app.spotify.com`) and local tools **of the same user**; web pages and other users' programs are refused (HTTP 403).
- Audio is captured only while the visualizer is on. With it off, SpoSync does not touch your audio device.
- Lyrics for SpoSync come from the same sources the theme uses: spolyrc first, then Spotify, then [lrclib](https://lrclib.net/). The theme fetches them for the helper only while SpoSync's window is open. A hidden or background SpoSync causes no lyric requests.
- The log file holds no track titles, lyrics or search text.

### Install

The installers ask `Install SpoSync? [y/N]` after the normal SpoTUI CLI install. The default is No, and with no terminal the answer is No. Flags and environment variables skip the question.

| Windows | Linux | Meaning |
|---------|-------|---------|
| `-SpoSync` | `--sposync` | Install SpoSync without asking, together with the CLI |
| `-NoSpoSync` | `--no-sposync` | Never install or ask |
| `-SpoSyncOnly` | `--sposync-only` | Install only SpoSync, skip the CLI |
| `-SpoSyncExe <path>` | `--sposync-bin <path>` | Install this local binary instead of building one |
| `SPOTUI_SPOSYNC=1` or `0` | `SPOTUI_SPOSYNC=1` or `0` | Same as the yes / no flags (environment variable) |
| `SPOTUI_SPOSYNC_EXE` | `SPOTUI_SPOSYNC_BIN` | Same as the path flags (environment variable) |

Flags win over environment variables. On Windows, `-NoSpoSync` together with `-SpoSync` or `-SpoSyncOnly` is a contradiction: the installer says so and does nothing.

**From a clone (works today, builds from source if you have Python 3.12 to 3.15; it asks `[y/N]` before the build, and with no terminal the answer is No):**

```powershell
git clone -b live https://github.com/NoxLoveYa/SpoTUI.git
cd SpoTUI
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\install\windows\install.ps1 -SpoSyncOnly
```

```bash
git clone -b live https://github.com/NoxLoveYa/SpoTUI.git
cd SpoTUI
bash scripts/install/linux/install.sh --sposync-only
```

**One line, with a binary you already have:**

```powershell
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/NoxLoveYa/SpoTUI/live/scripts/install/windows/install.ps1))) -SpoSyncOnly -SpoSyncExe C:\path\to\sposync-win64.exe
```

```bash
curl -fsSL https://raw.githubusercontent.com/NoxLoveYa/SpoTUI/live/scripts/install/linux/install.sh | bash -s -- --sposync-only --sposync-bin /path/to/sposync-linux-amd64
```

A one-line download has no source to build from, so it always needs a binary. On Windows you can pass it with the environment variables instead of flags: `$env:SPOTUI_SPOSYNC='1'; $env:SPOTUI_SPOSYNC_EXE='C:\path\to\sposync-win64.exe'; irm https://raw.githubusercontent.com/NoxLoveYa/SpoTUI/live/scripts/install/windows/install.ps1 | iex`. That also installs the SpoTUI CLI; without `SPOTUI_SPOSYNC_EXE` it ends in "SpoSync skipped". On Linux, run the installer as your normal user, not with `sudo`: it refuses to install SpoSync as root, because SpoSync is a per-user helper. The Linux installer exits `2` on an unknown argument or on contradicting flags (`--sposync` or `--sposync-only` together with `--no-sposync`) and `1` when the CLI install fails; with `--sposync-only` it also exits `1` unless SpoSync ends up installed, running or not.

Run the installer again to update. It asks the old helper to exit, replaces the binary and starts the new one.

### Where files go

| Item | Windows | Linux |
|------|---------|-------|
| Binary | `%LOCALAPPDATA%\SpoTUI\sposync\sposync.exe` | `${XDG_DATA_HOME:-~/.local/share}/sposync/sposync` |
| Log | `%LOCALAPPDATA%\SpoTUI\sposync\sposync.log` | `${XDG_STATE_HOME:-~/.local/state}/sposync/sposync.log` |
| Autostart | `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` value `SpoSync` = `"<Windows folder>\System32\conhost.exe" "<exe>" --tray` | `${XDG_CONFIG_HOME:-~/.config}/autostart/sposync.desktop`, runs `<binary> --headless` |
| Starts | At sign-in, hidden in the system tray | At graphical login, in the background with no window |

Windows uses `conhost.exe` so the window can be hidden and shown even when Windows Terminal is your default terminal. The Run value is a plain string with both paths written out in full (for example `C:\Windows\System32\conhost.exe`), not `%SystemRoot%`.

### Using it

- **Windows:** SpoSync sits in the tray. Choose **Show** in the tray icon's menu to open the window and **Quit** to exit. Closing the window with `q` offers **Hide to tray**. Running `sposync.exe` again brings the running window forward. If you start it yourself from Windows Terminal, the helper cannot hide to the tray: it offers **Run in background** instead. Autostart at sign-in always uses the tray.
- **Linux:** there is no tray. Open the window in a terminal with `~/.local/share/sposync/sposync --replace`. Closing it with `q` and choosing **Run in background** hands back to the background helper.
- **Both:** `sposync --quit` asks the running helper to exit (exit code `0` done, `1` nothing was running, `2` the port is held by another program or by another user's SpoSync, or the helper did not exit within 10 seconds). `sposync --version` prints the version.
- **Flag `--no-peer-check`:** turns off the check that a connecting program belongs to the same signed-in user as SpoSync (see "Shared computers" under Troubleshooting). Use it only to find out why Spotify stays disconnected. The installer never sets it, and SpoSync logs `peer check disabled by --no-peer-check` at start.

### Logs

The log records start and stop, connections, rejected origins and audio problems. It rotates at 256 KiB and keeps one backup. Paths are in the table above. If the Windows installer's source build fails, it keeps the build log at `%LOCALAPPDATA%\SpoTUI\sposync\build.log` (the uninstaller removes it).

### Build from source

```powershell
sposync\build-win.cmd
```

```bash
bash sposync/build-linux.sh
```

Both create a private virtual environment under `sposync/venv`, install the packages from `sposync/requirements-build.txt`, run PyInstaller, and print the SHA256 of the result as the last line. Only the top-level packages are pinned; their dependencies are not, so two builds made at different times can differ and builds are not reproducible. Output goes to `sposync/bin/` (`sposync-win64.exe` or `sposync-linux-<arch>`). They need Python 3.12 to 3.15: the pinned numpy, pillow and websockets need 3.12 or newer, and PyInstaller does not support 3.16 yet. On Debian and Ubuntu the Linux build also needs `python3-venv` (or `python3.X-venv` for the version used). Both scripts recreate a venv that was made with a Python outside that range. A Linux binary runs on the glibc it was built against or newer, so build on the oldest system you want to support.

### Uninstall

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uninstall\windows\uninstall.ps1 -SpoSyncOnly
```

```bash
bash scripts/uninstall/linux/uninstall.sh --sposync-only
```

`-SpoSyncOnly` / `--sposync-only` removes SpoSync and keeps the CLI. The normal uninstall scripts remove SpoSync as well. Both stop the helper and delete the autostart entry, the binary and the log.

### Troubleshooting

- **Port 8765 is busy:** another program holds it. A program that answers on the port makes SpoSync exit at once with code `2` and `port 8765 in use by another program`. A holder that does not answer, or a port that cannot be bound, is retried for 10 seconds first. The installer names the program when it can see it: on Windows always, on Linux only when it belongs to the same user (otherwise it says the owner may be another user). Close that program, then start SpoSync again or sign in again.
- **The log says `port 8765 cannot be bound (reserved or blocked by the system)`:** Windows can reserve port ranges for other components. List them with `netsh int ipv4 show excludedportrange protocol=tcp` and `netsh int ipv6 show excludedportrange protocol=tcp`. If 8765 is inside a listed range, SpoSync cannot use it until that range is released, which often happens after a restart.
- **Shared computers:** SpoSync checks that every connecting program belongs to the same signed-in user as the helper. A program of another user is refused (HTTP 403), for Spotify and for local control (`--quit`, Show) alike, so a second person's Spotify cannot use your SpoSync or quit it. Only one signed-in user at a time can run SpoSync: while yours holds port 8765, the second person's SpoSync exits with `port 8765 held by another user's SpoSync` in its log, and their SpoTUI shows SpoSync as disconnected (no visualizer). To switch, the first person quits SpoSync (tray menu Quit, or `sposync --quit`), then the second starts theirs. Programs running as the same user can still talk to the helper; web pages cannot.
- **Spotify stays disconnected:** open the log (paths in the table above). If it has `rejected peer unknown (...)` lines, the user check could not tell who is connecting. Run SpoSync by hand with `--no-peer-check` to confirm that this is the cause (on Windows, run the exe from a terminal; do not edit the registry autostart value), then report the issue. If the log has `peer check self-test failed (...); peer check off for this run` (Windows) or `peer check unavailable (...)` (Linux), SpoSync has already turned the check off by itself and accepts local clients as before; the cause is then elsewhere, for example the port problems above. If the log says `port 8765 held by another user's SpoSync`, see "Shared computers".
- **Flat bars and `no loopback audio device` in the log:** SpoSync found no output device to listen to. On Windows check that a playback device is enabled. On Linux it needs PulseAudio or PipeWire (with `pipewire-pulse`) and a `.monitor` source, which `pactl list short sources` lists. SpoSync keeps running and retries every few seconds.
- **Windows: autostart does not run:** open Task Manager, **Startup apps**, and enable SpoSync. The installer never changes that setting.
- **Linux: nothing starts at login:** some sessions (i3, sway and other bare window managers) do not run XDG autostart entries. Add `exec "$HOME/.local/share/sposync/sposync" --headless` to your session config.
- **Windows: Show does nothing or opens the wrong window:** in Windows settings, search for "default terminal application" and set it to **Windows Console Host**.
- **Antivirus flags `sposync.exe`:** PyInstaller one-file programs are sometimes reported as false positives. Build it yourself from source if you prefer.

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

  > Optional: install the SpoSync helper (needed for the visualizer), see [SpoSync](#sposync).

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

  > Optional: install the SpoSync helper (needed for the visualizer), see [SpoSync](#sposync).

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

## License

Copyright (C) 2026 SkenS (SkenSMasteR). SpoTUI is licensed under the GNU General Public License v2 (GPL-2.0). See the [LICENSE](license) file.
