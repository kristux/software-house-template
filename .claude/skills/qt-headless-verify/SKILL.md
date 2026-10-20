---
name: qt-headless-verify
description: Verify Qt widget, menu, or GUI behavior when GUI automation is blocked (macOS TCC with no Accessibility/Screen-Recording permission, or any headless/CI environment). Construct the real widget headless and drive its actions with QAction::trigger(), and prove bounded-memory or eviction behavior with a live flood plus RSS sampling. Use when a Tester needs to verify a Qt app's menu toggles, checked-state, persisted settings, or memory behavior but cannot perform a real mouse-click.
---

Verify Qt GUI behavior without a driveable display. The two techniques below are
what actually worked on a Qt desktop app when macOS TCC blocked UI
automation. They generalise to any Qt app and any headless/CI box.

The core idea: **a real mouse-click on a menu action ends up calling
`QAction::trigger()`. So construct the real widget headless and call
`trigger()` yourself.** You exercise the exact same slot/signal path a click
invokes, without needing a display or accessibility permissions. This is
code-path-level proof, not a pixel-level click (see the limitation at the end).

## (a) Drive the real widget headless

Construct the real `MainWindow` (or whatever widget owns the actions) in a test
or a tiny harness, headless:

- Set the platform plugin to **minimal**: `QT_QPA_PLATFORM=minimal`.
  - `offscreen` is often NOT built (it can need freetype/fontconfig that the
    vcpkg qtbase was not configured with). `minimal` is the safe default; only
    reach for `offscreen` if you have confirmed it is present.
- Use a **`QGuiApplication` or `QApplication`, not a bare `QCoreApplication`.**
  If any constructed object builds a `QPixmap`/`QIcon`/anything GUI (for example,
  a model that builds a `QPixmap` in its constructor), a bare `QCoreApplication`
  (what `QTEST_GUILESS_MAIN` gives you) will abort at runtime. In a Qt Test that
  needs widgets, use `QTEST_MAIN` (supplies a `QApplication`) with
  `QT_QPA_PLATFORM=minimal` set in the environment, rather than
  `QTEST_GUILESS_MAIN`.
- Drive behavior by calling the action directly:

  ```cpp
  window.actionModeB->trigger();                      // same path a menu click takes
  QCOMPARE(window.actionModeA->isChecked(), false);   // mutual exclusion
  QCOMPARE(window.actionModeB->isChecked(), true);    // checked-state
  ```

What you can prove this way (all done on that app):

- **Mutual exclusion / radio behavior:** trigger one action, assert the others
  auto-uncheck and no invalid combined state is reachable (`bothChecked == 0`).
- **Checked-state wiring:** the action reflects the model/setting it drives.
- **Persisted settings:** after triggering, read the setting back and assert it
  followed. On macOS, settings for org "example.com" / app "MyApp" live under
  domain `com.example.MyApp`:
  `defaults read com.example.MyApp mode` returns 0/1/2.
- **Restore-in-one-state:** `defaults write com.example.MyApp mode
  -int 2` before launch, then assert exactly that mode is active and the others
  are not; delete the key and set a legacy key to prove migration.

## (b) Live flat-RSS flood (prove bounded memory, not just row count)

For a bounded-buffer / eviction guarantee, row-count-flat is necessary but NOT
sufficient (a per-message leak keeps the count flat while RSS climbs). Prove
**RSS flat** under a sustained flood. Recipe:

1. Preset the app via settings so "past the cap" is instant and no display or
   menu is needed:

   ```sh
   defaults write com.example.MyApp capacity   -int 100
   defaults write com.example.MyApp mode       -int 2         # the mode under test
   defaults write com.example.MyApp saveDir    -string /tmp/flood-empty
   ```

2. Launch the **inner** app binary directly (not `open`), so you get a PID and
   stdout:

   ```sh
   <build-dir>/MyApp.app/Contents/MacOS/MyApp &
   PID=$(pgrep -f MacOS/MyApp)
   ```

3. Flood well past the cap with a small sender script (thousands of times the
   cap). Make it speak the app's real input protocol. If the app expects a
   handshake from clients, send it first. Put a monotonic sequence number in each message so oldest-dropped/newest-kept is
   checkable.

4. Sample RSS across the flood:

   ```sh
   while kill -0 $PID 2>/dev/null; do ps -o rss= -p $PID; sleep 1; done   # KB
   ```

   - **PASS:** after the buffer first fills (baseline taken a few seconds in),
     RSS shows no upward trend, final within ~10 MB of the post-cap baseline, no
     crash; row count pinned at the cap throughout.
   - **FAIL:** RSS climbs roughly linearly with messages sent (a leak), or the
     app crashes.

5. **No disk I/O** where the mode forbids it: after the flood, `ls
   /tmp/flood-empty` shows no new files. Contrast with a mode that DOES write (run
   the same flood in that mode and confirm a file appears) so the pass proves
   the write path exists and was correctly not taken, not that it is merely
   absent.

## The standing limitation (record it in acceptance)

A real **visual mouse-click** of a menu item cannot be automated where macOS TCC
withholds Accessibility / Screen-Recording from the sandbox. The
`QAction::trigger()` path above exercises everything a click invokes except the
final pixel-level hit-test and repaint. So:

- Acceptance of a GUI toggle rests on the **trigger-path proof plus a ~30s human
  eyeball**, not on an automated click.
- Record it as a residual, not a rejection: e.g. "The founder may open the menu
  and click the toggle once to see the other option visually uncheck; this is a human
  confirmation of already-proven behavior, not outstanding work."
- Never report the click as done by an agent. Report exactly what was exercised
  (the trigger path) and hand the visual check to the founder.
