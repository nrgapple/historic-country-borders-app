# Remaster screenshots (T5 P1 + P2, T7 P3 map key)

Taken 2026-11-18 from the Astro build (`yarn remaster:build`, `yarn remaster:preview`) with `node remaster/scripts/shoot.mjs`: Chromium in new-headless mode on the host GPU, at 2× device pixels. All T1, T2, T3 and T6 outputs are integrated (see `remaster/README.md`). Wikipedia is intercepted with a fixed summary so the panel is deterministic.

| File                                                                                   | View                                                                          | Compare with                                                                                          |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `1492-ottoman-1440x900.png`                                                            | 1492, Ottoman Empire selected, desktop                                        | `design/living-atlas/shots/a-classic-atlas-desktop.png`, `docs/product/style-review/1492-desktop.png` |
| `1492-ottoman-1024x768.png`                                                            | Same, tablet landscape (finder collapsed, stepper without subtitle)           | – (the mocks have no tablet width)                                                                    |
| `1492-ottoman-390x844.png`                                                             | Same, phone: two-row header, bottom sheet, selection framed above it          | `a-classic-atlas-phone.png`, `style-review/1492-phone.png`                                            |
| `1492-ottoman-iphone-insets-393x852.png`                                               | iPhone 15 Pro with simulated 59/34 px insets (CDP), island and home bar drawn | `a-classic-atlas-phone-safe.png`                                                                      |
| `1914-{1440x900,1024x768,390x844}-key-{open,closed}.png`                               | T7: 1914, no selection, the map key open and closed at each width             | `style-review/1914-desktop.png`, `1914-phone.png`; the 1914 shots before T7 (git history)             |
| `1914-europe-z2.6-1440x900.png`, `1815-europe-1440x900.png`, `1492-world-1440x900.png` | T7 label priority: state names over cities, viewport anchors                  | –                                                                                                     |

Notes:

- **Matches the mock:** plate-title year with era small caps, era washes and the ladder track with the madder diamond, the gazetteer panel (fact box, drop cap, credit, primary "Copy link"), and T6's cartography with neatline, grain, star capital and dependency hatch.
- **Deliberate differences from the mock:**
  - The phone header has two rows (brand and all tools, then the stepper), because plan §2.3 requires the ≤ 860 px two-row header and every tool stays reachable.
  - The phone sheet ends above the home indicator (plan §2.2 rule 3, enforced by T4's suite), where the mock padded its buttons inside it.
  - The panel has no "Compare 1400" button (not in scope) and no event list under Key dates (plan §2.1: needs a curated list).
- **Not shown:** the Key dates bar sits below the overview in the panel and needs scrolling at these sizes.

## T7: map key and label priority (2026-11-18)

Retaken with the T7 build (`node remaster/scripts/shoot.mjs`); the `-key-open`/`-key-closed` pairs click the "Key" toggle.

- **Key.** Title, locator globe with the view outlined in the era accent, a legend of only the classes drawn (here "Colony, protectorate or vassal" and "City"; no selection, so no "Selected territory"), the alternating scale bar ("Kilometres at 47° N") and the north arrow. Phones start with the scale bar and "Key" toggle; with the place sheet open (`1492-ottoman-390x844.png`) the key sits at the top of the map, and the framed selection is padded below it.
- **Labels, 1914.** Before T7, the German Empire had no name (it touched the Austro-Hungarian name and was dropped) and the Russian Empire was clipped at the right edge at 1440 and missing at 1024 and 390. Now the German Empire's name moves one line up, and the Russian Empire is named in its visible part at every width and at z2.6 and z3.2.
- **Labels under the key.** At 1024 with the key open, Spain's name moves into the visible part of Spain; Morocco and Spanish Morocco, whose points sit under or beside the key with too little visible land, are hidden rather than drawn half under it. Closing the key brings them back.
- **Not handled.** Sea and ocean names are not re-anchored (the Atlantic's name runs under the key in `1815-europe-1440x900.png`), and a name clipped at a map edge whose territory is under 100,000 km² or mostly off screen stays clipped (the Ottoman Empire at the right edge of the 1914 phone shot).
