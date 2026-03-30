# Circle Drawing Interactive

**Live Site Link:** https://content-interactives.github.io/circle_drawing/

A React single-page interactive for placing circles on a Cartesian coordinate plane. Users click **center** then **radius point** (integer lattice); the circle radius is the Euclidean distance between those two snapped grid points. Consecutive draws are supported with undo/redo, a sliding window of visible circles, and a short radius “grow” animation when a circle completes.

## Tech stack

| Layer | Choice |
|--------|--------|
| UI | React 19 |
| Build | Vite 7 with `@vitejs/plugin-react` |
| Styling | Component inline layout; `src/glow.css` for segmented control chrome |
| Deploy | `gh-pages` publishing `dist/` |

Production builds assume hosting under the path **`/circle_drawing/`** (see `vite.config.js` → `base`).

## Repository layout

```
src/
  main.jsx          # App bootstrap
  App.jsx           # Renders CircleDrawing
  index.css         # Global styles
  glow.css          # Segmented “glow” button (Undo / Redo / Reset)
  components/
    CircleDrawing.jsx   # Main interactive (SVG plane + state)
```

## Coordinate system

- **Logical domain**: \([-10, 10]\) on both axes, inclusive integer ticks only for placed points.
- **Canvas**: Fixed `500×500` SVG pixels inside a positioned container (`WIDTH`, `HEIGHT` in `CircleDrawing.jsx`).
- **Padding**: `40px` margins define the inner “plot” so the grid aligns with the labeled range.
- **Mapping** (y flipped for screen coordinates):
  - `valueToX(x)`, `valueToY(y)` — model → SVG
  - `xToValue(px)`, `yToValue(py)` — SVG → model
- **Snapping**: Pointer positions are converted to model space, **clamped** to \([-10,10]\), then **rounded to the nearest integer** (`roundToTick`). That makes every placed point a lattice point.

Circles use **`scaleX`** (not an average of x/y scale) when converting radius from model units to SVG pixels so a unit circle remains geometrically round on the square grid.

## Interaction model

1. **Click** adds one snapped point. Odd index = center; even index (after the first pair) completes a circle.
2. **Completing a circle** sets `animatingCircleIndex` and drives `circleProgress` from 0 → 1 over `CIRCLE_ANIMATION_DURATION_MS` (1500 ms) via `requestAnimationFrame`. The displayed radius is `rValue * circleProgress`.
3. While animating, **new clicks are ignored**.
4. **Ghost circle** (dashed, semi-transparent): After a center is placed, mouse move shows the circle that would result if the hover lattice point were the second point. Requires `MIN_RADIUS` (0.5) in model space so coincident center and preview do not draw a degenerate circle.
5. **Hover preview**: Semi-transparent point at the snapped grid cell under the cursor.

Undo/Redo/Reset controls use `stopPropagation()` so they do not place points. Reset clears history and animation state.

## State and history

| State | Role |
|--------|------|
| `pointsHistory` | Full list of placed `{x, y}` in model space |
| `historyIndex` | Cursor into history; “current” points are `pointsHistory.slice(0, historyIndex)` |
| `animatingCircleIndex` | Which completed circle (by index in `allCirclesData`) is animating, or `null` |
| `circleProgress` | 0–1 scale factor on radius during animation |
| `showHistoryGlow` | Toggles orbit animation on the control cluster (`hide-orbit` class when false after undo/redo/reset) |

Undo moves `historyIndex` back; redo moves it forward without discarding tail entries. This is a standard **array + index** undo/redo pattern.

## Rendering rules

- **Grid**: SVG `<pattern>` aligned to `GRID_CELL` (= `scaleX`).
- **Axes**: Lines plus arrow polygons and tick labels; origin label omitted on ticks for readability.
- **Visible circles**: At most **`MAX_CIRCLES` (2)** full circles. Index `visibleCircleStart`/`visiblePointStartIndex` sync which points and circles are drawn.
- During animation, the animating circle is drawn separately with scaled radius; other recent circles still obey the cap.
- **Clipping**: Circles use `clipPath="plot-clip"` over the full view to keep strokes tidy at edges.

## Accessibility

Root container: `role="application"`, `aria-label="Circle drawing coordinate plane"`, `tabIndex={0}` so the region is focusable. SVG uses `pointerEvents: 'none'`; hit testing is on the wrapper `div`.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Vite dev server (HMR) |
| `npm run build` | Production bundle → `dist/` |
| `npm run preview` | Local preview of `dist/` |
| `npm run deploy` | `predeploy` runs build; `gh-pages -d dist` |

For GitHub Pages project sites, the app is expected at `https://<user>.github.io/circle_drawing/` matching `base: '/circle_drawing/'`.

## Tunables (source constants)

Relevant exports are not centralized; adjust literals at the top of `src/components/CircleDrawing.jsx`:

- `MIN` / `MAX` — axis range
- `WIDTH` / `HEIGHT` / `PADDING` — layout
- `MAX_CIRCLES` — how many completed circles stay visible
- `CIRCLE_ANIMATION_DURATION_MS` — grow animation length
- `MIN_RADIUS` — minimum model-space radius to draw a circle (avoids zero radius)

## License / upstream

Check repo root or organization policy for license. Content-Interactives naming in cache paths suggests deployment to a GitHub org; align `base` in Vite if the public path changes.
