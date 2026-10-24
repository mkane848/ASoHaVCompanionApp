# Real-device checklist (iPhone and iPad)

The automated passes (`docs/operations.md`: responsive matrix, interaction states, behaviour checks, and
the WebKit run) drive Chromium and Playwright's WebKit on Linux with phone- and iPad-shaped windows. They
cannot see what only iOS and iPadOS Safari do. This is the short list to run on a **real device** before
telling players a release is good, about ten minutes. Tick what you checked; write down anything odd with
the device, orientation and what you were doing.

Use the live site (https://asohav.onrender.com), signed in as a GM and, if you can, as a player in a
second browser, so the Realtime checks have something to show.

## Every release: iPhone

- [ ] **No zoom on focus.** Tap each kind of text field once: the campaign invite email, a Clock title,
  the Combat Goal, a notes box in End the Session, the character creation name. The page must not zoom
  in. (A field under 16px makes iOS zoom and stay zoomed; the behaviour suite asserts the size, this
  confirms it on the real browser.)
- [ ] **Toolbar behaviour.** Scroll a long page (the character sheet) until Safari's address bar
  collapses, then open a dialog. The dialog's buttons must be fully on screen and tappable, and nothing
  sits under the toolbar.
- [ ] **Landscape.** Rotate to landscape on the sheet, Combat and a dialog (End the Session, Add
  Participant). Dialogs must scroll rather than run off the bottom; the sticky header must not eat the
  screen.
- [ ] **Keyboard.** Open the invite email field and the End the Session note with the keyboard up. The
  field you are typing in must stay visible, and the Send/Save button must be reachable by scrolling.
- [ ] **Edge swipe.** On the character sheet's horizontal section strip, swipe from the very left edge.
  Safari's back gesture must not fight the strip's own scrolling.
- [ ] **Double-tap.** Double-tap Next Round, a Clock `+1`, and Strain. Next Round advances once; both
  Clock ticks count. No accidental page zoom on any button.
- [ ] **Lock and unlock.** In a Combat view, lock the phone for about 30 seconds, change something from
  the other browser, unlock. The view must catch up on its own (the reconnect resync).
- [ ] **Readability.** Look at both appearances (Parchment, Notice Board) outdoors-bright if you can:
  muted labels, placeholders, and "Entering combat" on Notice Board's dark ground.

## Every release: iPad (portrait and landscape)

iPadOS Safari presents a desktop-class browser, so anything that assumes "phone layout on a small
screen" or sniffs the user agent can be wrong here. Check both orientations.

- [ ] **Layout uses the screen.** Character sheet, campaign page and Combat at portrait and landscape:
  panels use the width sensibly (no narrow column floating in a wide screen, no cramped two-column
  squeeze at portrait).
- [ ] **Touch size.** Controls are comfortable for thumbs held at the bottom corners in landscape; nothing
  important is only reachable at a screen edge.
- [ ] **Split View and Slide Over.** Put the app beside another app at roughly one third, one half and
  two thirds, then in Slide Over. The layout must switch cleanly at each width, with no horizontal
  scroll, no overlapping controls, and a usable app bar.
- [ ] **Stage Manager (if the iPad supports it).** Resize the window across its range. Nothing breaks
  mid-resize.
- [ ] **Keyboard types.** With the on-screen keyboard, the floating keyboard, and a Magic Keyboard /
  trackpad: fields stay visible, and no control behaves differently with a pointer attached (hover-only
  tooltips and hints must have a touch equivalent).
- [ ] **Dialogs in landscape.** The iPad is only about 820px tall in landscape; End the Session, Make
  Camp and Add Participant must scroll inside their own box.
- [ ] **Apple Pencil.** Tap and drag with a Pencil on steppers, tabs and the section strip. It should behave
  like a finger.
- [ ] **Rotate mid-task.** Rotate with a dialog open and with a form half-filled. Nothing is lost.
- [ ] **Add to Home Screen** (new in `0.80.0`, was under Occasionally): the icon is a placeholder gold "A"; the app launches full screen with a dark status bar and sign-in works. Standalone mode has no back button, so check you can get around.
- [ ] **Tooltips.** Tap an `i` and a glossary term in the left and right of the character sheet in portrait and landscape: the bubble sits just below the tapped thing, stays on screen, and a tap elsewhere closes it.
- [ ] **No double-tap zoom** on steppers, pips and Clock +1, with a pointer attached and without.
- [ ] **Chrome and layout.** App bar and sheet header are one slim row; the sheet's two columns look balanced; Combat shows controls beside the lists in landscape; Content Admin shows list and record side by side.

## Occasionally

- [ ] Add to Home Screen, then launch from the icon: layout, status bar, and sign-in still work.
- [ ] Safari's text size (the aA menu) at 125% and 150%: nothing overlaps or is cut off.
- [ ] Low Power Mode or a slow connection: saves show their pending state and errors are visible (a
  toast), not silent.

## When something fails

Note the device and iPadOS/iOS version, the orientation, the width of the window if it was in Split View,
and the exact steps. A failure that the automated passes missed is a candidate for a new check in
`apps/web/scripts/behavior-smoke.mjs` once it is understood; say so in the issue.
