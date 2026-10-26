# Samsung TV platform notes

Behaviour of Samsung's own software that limits or shapes what CleanFrame can do. This page separates what was observed on a real TV from what another project reports, because neither establishes compatibility with a different model or firmware.

## Provenance

| Marked | Meaning |
| --- | --- |
| Verified | Observed on an installed CleanFrame, with a person confirming the result on screen |
| Reported | Documented by the [Glass Home](https://github.com/victaphu/glass-home-samsung-tv) project (MIT) on other TVs; plausible but untested here |
| Platform limit | Samsung's software is responsible; CleanFrame cannot change it safely |

The verified rows come from a 2022 LS03B on Tizen 6.5, a different TV from the reference setup in [TV status](tv-status.md). Treat both as single data points.

## The Home button inside HbbTV apps

**Platform limit — verified.** Home from normal apps reaches CleanFrame. Home from inside an HbbTV app (DR TV) opens Samsung Home instead, and a second Home press then reaches CleanFrame.

The HbbTV host owns its own exit and does not consult the AUL `operation/main` assignment. Both `/usr/apps/org.tizen.hbbtv/bin/hbbtv_app` and `/usr/bin/hbbtv_service` contain the hardcoded string `com.samsung.tv.csfs` beside their Smart Hub key handling.

Two candidate settings were tried and reverted:

| Setting | Result |
| --- | --- |
| `db/first_screen/type` | No effect on the HbbTV exit; reverted |
| `db/appfw/overlay_home_appid` | TV showed CleanFrame with a loading overlay, then fell back to Samsung Home. The key only accepts an app that can run as an overlay; a normal web app times out. Reverted to empty |

Do not alias `com.samsung.tv.csfs` to another app. That redirect would also take away CleanFrame's own route to Samsung Home, which is where picture, input and network settings live. Two Home presses is the honest workaround.

## Firmware upgrades can remove a sideloaded app

**Reported.** Tizen upgrades, including moves to One UI Tizen, have removed sideloaded apps on other TVs.

This matters more here than for a Home-row pinned app: Home and startup are assigned to the app by native configuration, so an upgrade that removes the app would leave those assignments pointing at something absent.

- Run `python3 scripts/native-home/run.py restore` before accepting a major OS upgrade.
- After any firmware update, confirm the app is still installed before assuming Home works.

## Settings worth turning off

**Reported**, on a 2023 Q70C running Tizen 8. Menu names and positions vary by year and model. Record each current value before changing it; every row has an undo.

"Settings" below means: on the Home screen press Left, go down to **Settings**, press OK, then **All Settings**.

| Change | Where | Undo |
| --- | --- | --- |
| Stop content recognition (identifies what is on screen, HDMI included, for ads) | Left menu → **Privacy Choices** → Terms & Conditions, Privacy Policy → untick **Viewing Information Services** → move down to **OK**, leaving "I agree to all" unticked | Same screen, tick it, OK |
| Stop personalised ads | Same screen: untick **Interest-Based Advertisements** | Tick it again |
| Reset the advertising ID | All Settings → General & Privacy → Terms & Privacy → **Reset PSID** → Reset | Not reversible by design; nothing depends on the old ID |
| Stop promotional pop-ups | **Notification** (just above All Settings) → gear icon → untick **Samsung Promotion** → OK | Tick it again |
| Mute Home-row previews | Home → For You tab → bottom of the row → Media Options → **Autoplay Sound** | Press OK again |
| Tidy the Home row | Highlight a tile, hold OK → **Remove**; the app stays installed. Hold OK and use Left/Right to move tiles | Apps tab → App Settings → the app → **Add to Home** |

Careful in these menus:

- **Factory data reset** sits directly below Start Screen Options.
- **Delete** in App Settings uninstalls; use Add to Home or the Home row's Remove instead.
- **Reset Smart Hub** (Support → Device Care) signs you out of everything and removes downloaded apps.

**Do not change "Start with Smart Hub Home" on an installation that already has native startup.** Glass Home needs that setting because it relies on autorun; a natively assigned startup app does not, and the interaction between the two is untested.

## DNS ad filtering

**Reported**, and the one change here with a real failure mode. All Settings → Connection → Network → **Network Status** → **IP Settings** → **DNS Setting**: choose **Enter manually**, set **DNS Server** to `76.76.2.37` (backup `76.76.10.37`, Control D's free no-log HaGeZi Light filter), then Done and OK. Leave the IP setting automatic.

- On that TV the remote's number keys did not fill the DNS boxes; the on-screen keypad did.
- That filter reportedly blocked Samsung ad, content-recognition and crash-log hosts while leaving firmware updates, the app store, the account and the main streaming apps working. It does not touch ads inside YouTube or a video stream, and it blocks some broadcasters' analytics.
- The TV takes a single DNS server, so if the filter service is down the TV has no internet. If the TV loses internet and other devices do not, set DNS back to **Get automatically** first.
- Undo: same screen → **Get automatic** → OK.

This has not been checked on the verified installation, and it changes name resolution for the app and for firmware updates.

## Recipes for future work

**Reported** by an S95B owner on Tizen 6.5, the same generation as the verified installation:

- **HDMI inputs:** `tizen.tvwindow.setSource` followed by launching `org.tizen.tv-viewer`, which fills the screen with the input.
- **YouTube shortcuts:** a plain `watch?v=` link worked from a cold start and with YouTube already running, while Samsung's documented `PAYLOAD` deep link lost the video at the "Who's watching?" screen. Keep the plain form.
- **Websites** open in Samsung's own browser through Samsung's documented method. That path was not confirmed on a TV.

## Sources

- [Glass Home](https://github.com/victaphu/glass-home-samsung-tv) and its [`docs/SAMSUNG-SETTINGS.md`](https://github.com/victaphu/glass-home-samsung-tv/blob/main/docs/SAMSUNG-SETTINGS.md) — the reported settings, DNS filter and recipes above. MIT licensed.
- [TV status](tv-status.md) — the reference TV and what has been physically confirmed there.
- [Native Home and recovery](../scripts/native-home/README.md) — the Home/startup assignment and its rollback.
