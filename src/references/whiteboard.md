# Interactive Whiteboard — Command Reference

Use the whiteboard to make abstract ideas concrete: diagrams, flowcharts,
timelines, math layouts, hierarchies, and concept maps. Diagrams are especially
important in **Guia Fiel** (deaf/mute) mode, where they carry most of the
meaning.

## Design principles

- **Corporate & clean look.** Always set `"roughness": 0` (perfectly straight
  lines) and `"fontFamily": 2` (modern sans-serif). This gives the premium,
  legible appearance the product depends on.
- **Structured alignment.** Place shapes on a tidy grid — aligned, evenly
  spaced, with consistent sizes for items of the same kind.
- **Show flow.** Connect related shapes with arrows (`"type": "arrow"`) to make
  hierarchy, sequence, or causation explicit.
- **Soft shading.** For filled boxes use `"fillStyle": "solid"` or
  `"cross-hatch"` with a soft background (e.g. `#e8f0fe`) and a matching line
  color (e.g. `#1a73e8`).

## Color palette (use only these)

| Color     | Hex       | Meaning                                            |
|-----------|-----------|----------------------------------------------------|
| Blue      | `#1a73e8` | General concepts, structural containers            |
| Green     | `#34a853` | Stable states, correct steps, key definitions      |
| Red       | `#ea4335` | Critical areas, attention points, warnings         |
| Yellow    | `#fbbc05` | Cautions, intermediate steps                       |
| Purple    | `#9c27b0` | Auxiliary structures, annotations                  |

Soft background fills (pair with the matching line color):
- Blue fill `#e8f0fe`, Green fill `#e6f4ea`, Red fill `#fce8e6`,
  Yellow fill `#fef7e0`, Purple fill `#f3e5f5`.

## Command format

Emit one command per shape. Multiple commands per turn are allowed.

```
[GT_WHITEBOARD_COMMAND: {
  "id": "unique_id",
  "type": "square|circle|text|arrow|line",
  "x": 100, "y": 100,
  "width": 120, "height": 60,
  "content": "LabelText",
  "color": "#1a73e8",
  "roughness": 0,
  "fontFamily": 2,
  "fillStyle": "solid",
  "backgroundColor": "#e8f0fe"
}]
```

Field notes:
- `id` — unique per shape; arrows reference shapes by their coordinates/order.
- `type` — `square`/`circle` for nodes, `text` for labels, `arrow`/`line` for links.
- `x`, `y` — top-left position; keep a consistent left margin and row spacing.
- `width`, `height` — omit or keep small for `text`; size nodes consistently.
- `content` — the visible label (keep it short).
- `color` — line/text color from the palette.
- `backgroundColor` — soft fill; pair with `fillStyle`.

## Example 1 — Simple two-step flow

```
[GT_WHITEBOARD_COMMAND: {"id": "n1", "type": "square", "x": 80, "y": 100, "width": 160, "height": 60, "content": "Problema", "color": "#1a73e8", "roughness": 0, "fontFamily": 2, "fillStyle": "solid", "backgroundColor": "#e8f0fe"}]
[GT_WHITEBOARD_COMMAND: {"id": "a1", "type": "arrow", "x": 240, "y": 130, "width": 80, "height": 0, "color": "#1a73e8", "roughness": 0}]
[GT_WHITEBOARD_COMMAND: {"id": "n2", "type": "square", "x": 320, "y": 100, "width": 160, "height": 60, "content": "Solução", "color": "#34a853", "roughness": 0, "fontFamily": 2, "fillStyle": "solid", "backgroundColor": "#e6f4ea"}]
```

## Example 2 — Highlighting a warning step

```
[GT_WHITEBOARD_COMMAND: {"id": "w1", "type": "square", "x": 80, "y": 220, "width": 200, "height": 60, "content": "Atenção: divisão por zero", "color": "#ea4335", "roughness": 0, "fontFamily": 2, "fillStyle": "cross-hatch", "backgroundColor": "#fce8e6"}]
```

## Accessibility note

When **Guia Fiel** mode is active, prefer diagrams and embed avatar-trigger
keywords (e.g. *correto*, *cuidado*, *observa*) in the surrounding text so the
signing avatar reacts in sync with the drawing. When **Light in Dark** mode is
active, never rely on the whiteboard alone — narrate every shape and its
position in spoken, clock-face terms.