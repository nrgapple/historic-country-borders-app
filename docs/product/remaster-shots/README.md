# Remaster screenshots (T5, P1 + P2)

Taken 2026-11-18 from the Astro build (`yarn remaster:build`, `yarn remaster:preview`) with `node remaster/scripts/shoot.mjs`: Chromium in new-headless mode on the host GPU, at 2× device pixels. All T1, T2, T3 and T6 outputs are integrated (see `remaster/README.md`). Wikipedia is intercepted with a fixed summary so the panel is deterministic.

| File                                                         | View                                                                          | Compare with                                                                                          |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `1492-ottoman-1440x900.png`                                  | 1492, Ottoman Empire selected, desktop                                        | `design/living-atlas/shots/a-classic-atlas-desktop.png`, `docs/product/style-review/1492-desktop.png` |
| `1492-ottoman-1024x768.png`                                  | Same, tablet landscape (finder collapsed, stepper without subtitle)           | – (the mocks have no tablet width)                                                                    |
| `1492-ottoman-390x844.png`                                   | Same, phone: two-row header, bottom sheet, selection framed above it          | `a-classic-atlas-phone.png`, `style-review/1492-phone.png`                                            |
| `1492-ottoman-iphone-insets-393x852.png`                     | iPhone 15 Pro with simulated 59/34 px insets (CDP), island and home bar drawn | `a-classic-atlas-phone-safe.png`                                                                      |
| `1914-1440x900.png`, `1914-1024x768.png`, `1914-390x844.png` | 1914, no selection: Modern accent, "What changed"                             | `style-review/1914-desktop.png`, `1914-phone.png`                                                     |

Notes:

- **Matches the mock:** plate-title year with era small caps, era washes and the ladder track with the madder diamond, the gazetteer panel (fact box, drop cap, credit, primary "Copy link"), and T6's cartography with neatline, grain, star capital and dependency hatch.
- **Deliberate differences from the mock:**
  - The phone header has two rows (brand and all tools, then the stepper), because plan §2.3 requires the ≤ 860 px two-row header and every tool stays reachable.
  - The phone sheet ends above the home indicator (plan §2.2 rule 3, enforced by T4's suite), where the mock padded its buttons inside it.
  - The cartouche shows only the plate title until T7's map key.
  - The panel has no "Compare 1400" button (not in scope) and no event list under Key dates (plan §2.1: needs a curated list).
- **Not shown:** the Key dates bar sits below the overview in the panel and needs scrolling at these sizes.

## Pennsylvania school districts (P5, T8)

Taken 2026-11-18 the same way (`ONLY=pa node remaster/scripts/shoot.mjs <base>`). The district is selected by `?place=` with no camera in the link, so the app frames it clear of the panel or bottom sheet. Wikipedia is intercepted with fixture text marked as such.

| File                                  | View                                                                                                                                                                                                        |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pa-state-college-1440x900.png`       | State College Area selected, desktop: plate title with the PASDA vintage and source, gazetteer panel with county, IU, CTC and AUN, then Wikipedia, then the boundary source, caveat and correction guidance |
| `pa-state-college-1024x768.png`       | Same, tablet landscape (finder collapsed to its button)                                                                                                                                                     |
| `pa-state-college-insets-390x844.png` | Same, phone with simulated 47/34 px insets (CDP), island and home bar drawn: compact "PA school districts · Boundaries Oct 2025" header, district framed above the bottom sheet, ODbL credit at the top     |
| `pa-camp-hill-streets-1440x900.png`   | Camp Hill selected at z14.6: T8's named residential streets (z14 streets in z12 tiles), the selection band inside the district edge                                                                         |
| `pa-state-1440x900.png`               | The whole state, nothing selected: district names in small caps lead; cities in spaced roman capitals; overzoomed context outside the state                                                                 |

Notes:

- The map key slot shows a PA plate title only; T7's map key (and its PA form) had not landed on any sibling branch.
- The OpenStreetMap credit is in the attribution control and the credit strip on every size; About repeats it.
