---
phase: 06-foundation-v2
plan: 04
subsystem: theme-palette-visibility
tags: [next-themes, dark-mode, oklch, tailwind-v4, css-vars, presenter-mode, react-19]

requires:
  - phase: 01-foundation
    provides: PresenterFrame + data-presenter chrome rules, dashboard-header layout, globals.css scaffolding
  - phase: 06-foundation-v2
    provides: header right-side group already extended by 06-03 (Estado/Tipo filters land beside ThemeToggle)
provides:
  - ThemeProvider (next-themes wrapper, attribute=class, defaultTheme=system)
  - ThemeToggle (Sun/Moon button, dual-icon CSS swap + mount gate)
  - 6 section CSS vars in oklch (Indigo/Violet/Cyan/Amber/Emerald/Teal) — light + dark
  - 3 status CSS vars (verde/rojo/amarillo) — light + dark
  - Tailwind utilities: text-section-* / bg-section-* / text-status-* / bg-status-* via @theme inline
  - data-presenter-metric-hide CSS rule (CROSS-V2-07 conservative opt-out)
affects:
  - 07-bonos-payouts
  - 08-tarjeta-recargas
  - 09-vista-cliente
  - 10-inicio-infra

tech-stack:
  added: []
  patterns:
    - "next-themes attribute=class to align with existing @custom-variant dark (&:is(.dark *)) in globals.css"
    - "Dual-icon CSS swap (Sun dark:hidden + Moon hidden dark:block) so the icon flips with the .dark class without waiting on a React effect"
    - "Mount gate (useEffect → setMounted(true)) to suppress aria-label hydration mismatch — canonical next-themes SSR pattern"
    - "Section + status palette declared once in :root, lifted ~0.10 in lightness for .dark, exposed to Tailwind via @theme inline"
    - "Conservative-default per-metric visibility: tags hide ONLY when explicitly opted out (data-presenter-metric-hide), distinct from chrome-level data-presenter-hide and cliente-foco data-presenter-empresa-hide"

key-files:
  created:
    - src/components/layout/theme-provider.tsx
    - src/components/layout/theme-toggle.tsx
  modified:
    - src/app/globals.css
    - src/app/layout.tsx
    - src/components/layout/dashboard-header.tsx

key-decisions:
  - "next-themes attribute=class — aligns with the existing @custom-variant dark (&:is(.dark *)) selector in globals.css; no rewrite of dark-mode CSS needed"
  - "defaultTheme=system + enableSystem — first visit respects OS preference per CONTEXT.md; user override persists in localStorage"
  - "disableTransitionOnChange — avoids transition flash when toggling theme (next-themes recipe)"
  - "Palette in oklch (perceptual lightness) — uniform contrast lift (~0.10) when porting :root values to .dark; readable as numbers without hex/rgb gymnastics"
  - "Status palette intentionally aliases section palette (status-success ≡ section-clientes emerald, status-pending ≡ section-tarjeta amber) — single semantic source per hue family, deliberate (CROSS-V2-05)"
  - "Conservative-default opt-out for metric visibility (data-presenter-metric-hide) — nothing disappears in presenter mode unless explicitly tagged; Phase 9 (Vista Cliente CLI-V2-08) tags timeline + internal KPIs"
  - "ThemeToggle stays VISIBLE in presenter mode — operator may want to flip theme during a client meeting; placed outside data-presenter-hide region between LastRefresh and PresenterToggle"

patterns-established:
  - "Theme provider contract: Client Component wrapper around third-party providers (next-themes here) lets a Server Component RootLayout still configure provider props in one place"
  - "RootLayout dark-mode protocol: <html suppressHydrationWarning> + ThemeProvider wraps children — required because next-themes flips the class before React hydrates"
  - "Tailwind v4 token extension: declare CSS var in :root + .dark, then expose to utilities via @theme inline { --color-xxx: var(--xxx) } — no tailwind.config.js touch needed"
  - "Three-tier presenter visibility: chrome (data-presenter-hide) > cliente-foco (data-presenter-empresa-hide) > metric (data-presenter-metric-hide) — JSDoc block in globals.css enumerates all three"

duration: 2m 50s
completed: 2026-05-07
---

# Phase 06 Plan 04: Dark mode + paleta v2.0 + visibility por métrica Summary

**Site-wide dark mode toggle (next-themes), 6 section + 3 status palette tokens en oklch (light + dark), and CROSS-V2-07 conservative-default per-metric visibility opt-out — todo el visual layer foundation listo para Phases 7-10.**

## Performance

- **Duration:** 2m 50s (commits c4922dc 11:51:22 → e850fe6 11:54:12)
- **Started:** 2026-05-07T16:51:22Z
- **Completed:** 2026-05-07T16:54:12Z
- **Tasks:** 3 auto + 1 checkpoint:human-verify (approved)
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments

- **Dark mode site-wide** — `<html>` flips `.dark` via next-themes; `attribute="class"` matches the existing `@custom-variant dark (&:is(.dark *))` selector in `globals.css`, so v1.0 components inherit dark variants automatically without per-component edits
- **OS-preference default** — first visit respects `prefers-color-scheme`; explicit user toggle persists in localStorage and survives reloads
- **Section + status palette** — 9 CSS vars (`--section-inicio/bonos/payouts/tarjeta/clientes/recargas` + `--status-success/fail/pending`) declared in `:root` and shifted brighter (~+0.10 lightness) in `.dark`. Exposed to Tailwind via `@theme inline` so `text-section-bonos`, `bg-status-success`, etc. work as utilities in Phase 7+
- **Per-metric visibility rule** — `[data-presenter="on"] [data-presenter-metric-hide] { display: none !important }` ships alongside the existing chrome (`data-presenter-hide`) and cliente-foco (`data-presenter-empresa-hide`) rules. Default policy is conservative: nothing hides unless explicitly tagged
- **Header layout** — ThemeToggle slotted between `LastRefresh` and `PresenterToggle` in the right-side group (outside `data-presenter-hide` so operators can flip theme during a presentation)
- All gates green: `tsc --noEmit` clean, `npm run build` succeeds, `npm run lint` clean (after focused eslint-disable — see Deviations), zero deps added

## Task Commits

Each task was committed atomically:

1. **Task 1: Add palette CSS vars and data-presenter-metric-hide rule to globals.css** — `c4922dc` (feat)
2. **Task 2: Create ThemeProvider and ThemeToggle (next-themes)** — `721ece1` (feat)
3. **Task 3: Wire ThemeProvider in layout.tsx and ThemeToggle in dashboard-header.tsx** — `e850fe6` (feat)
4. **Task 4: Visual verification checkpoint** — user approved ("approved"), no commit (verification gate)

_Plan metadata commit will follow this SUMMARY._

## Files Created/Modified

- `src/components/layout/theme-provider.tsx` (NEW, 34 LOC) — Client Component wrapping `next-themes`' `ThemeProvider` with `attribute="class"`, `defaultTheme="system"`, `enableSystem`, `disableTransitionOnChange`. Spreads additional props for future customization
- `src/components/layout/theme-toggle.tsx` (NEW, 53 LOC) — `useTheme` button with Sun/Moon `lucide-react` icons. Mount gate (`useEffect → setMounted(true)`) ensures the aria-label reflects `resolvedTheme` only after hydration. Dual-icon CSS swap (`Sun dark:hidden` + `Moon hidden dark:block`) flips visuals instantly with the `.dark` class
- `src/app/globals.css` (MODIFIED, 243 LOC) — Added 9 palette vars to `:root`, mirrored brighter set to `.dark`, exposed all 9 to Tailwind via `@theme inline`. Added `data-presenter-metric-hide` rule + extended the JSDoc block to enumerate all three presenter visibility tiers
- `src/app/layout.tsx` (MODIFIED) — Added `suppressHydrationWarning` to `<html>` (next-themes flips `.dark` before React hydrates), imported `ThemeProvider`, wrapped `{children} + <Toaster />` in `<ThemeProvider>`
- `src/components/layout/dashboard-header.tsx` (MODIFIED) — Added `ThemeToggle` import + JSX render in the right-side group between `LastRefresh` and `PresenterToggle`. Header remains a Server Component; `ThemeToggle` is the Client Component

## Decisions Made

- **`attribute="class"` for next-themes** — chosen because `globals.css` already uses `@custom-variant dark (&:is(.dark *))`. Switching to `data-theme` would have required rewriting every dark-mode CSS rule shipped in v1.0
- **`defaultTheme="system"` + `enableSystem`** — `06-CONTEXT.md` requires "Default: respeta preferencia del OS en primera visita". `system` keeps the option exposed alongside light/dark for users who prefer to follow OS changes dynamically
- **`disableTransitionOnChange`** — recommended by next-themes docs to avoid transition flash; aligns with the goal of "page swaps light↔dark instantly, no flash" in the verification criteria
- **OKLCH for all palette tokens** — perceptual lightness lets us shift `:root` → `.dark` with a uniform `+0.10` lightness bump and trust the contrast scaling. Hex/RGB would have required per-color manual tuning
- **`status-success` = `section-clientes` emerald and `status-pending` = `section-tarjeta` amber by design** — the verde/rojo/amarillo semaphore aliases two section hues intentionally (single source per hue family). Phase 7+ choosing between `bg-section-clientes` and `bg-status-success` becomes an intent-clarity decision, not a color-difference decision
- **Conservative-default opt-out for `data-presenter-metric-hide`** — `globals.css` JSDoc explicitly states "Default policy: in `?presenter=1`, ALL metrics remain visible". This inverts naively from "hide by default, opt in to show" to "show by default, opt out to hide" so accidental tagging never breaks Vista Cliente
- **ThemeToggle outside `data-presenter-hide`** — operator may want to flip theme during a client meeting (e.g. dim room → dark mode). Trade-off: client sees the toggle. Acceptable per implicit reading of the plan ("operator control during meetings") and the conservative visibility default
- **Dual-icon CSS swap (not just JS state)** — `<Sun dark:hidden /><Moon hidden dark:block />` flips with the `.dark` class via CSS, so the icon updates the moment next-themes mutates `<html>` even if React hasn't re-rendered yet. The mount gate is a belt-and-suspenders safety net for the aria-label only

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] React 19 `react-hooks/set-state-in-effect` lint rule blocked the canonical next-themes mount gate**

- **Found during:** Task 3 (`npm run lint` after wiring everything together)
- **Issue:** The plan specifies the canonical next-themes SSR mount-gate pattern verbatim:
  ```tsx
  useEffect(() => {
    setMounted(true);
  }, []);
  ```
  React 19's `react-hooks/set-state-in-effect` lint rule (enabled by default in our config via the React 19 plugin set) flags `setState` directly inside `useEffect` as a potential anti-pattern, blocking `npm run lint` from passing the verification gate
- **Fix:** Kept the pattern exactly as the plan specifies — this IS the documented next-themes recipe (https://github.com/pacocoursey/next-themes#avoid-hydration-mismatch). Added a single-line `// eslint-disable-next-line react-hooks/set-state-in-effect` directly above the `setMounted(true)` call, plus a JSDoc comment block explaining:
  - Why the rule normally fires (legitimate anti-pattern guard)
  - Why this specific case is the documented next-themes pattern
  - What the alternative would be (rendering theme-dependent content during SSR) and why it's worse (causes the hydration mismatch the gate exists to prevent)
- **Files modified:** `src/components/layout/theme-toggle.tsx` (already shipped in commit `e850fe6`)
- **Verification:** `npm run lint` passes; comment makes the suppression auditable in code review
- **Committed in:** `e850fe6` (Task 3 commit — discovered post-Task-2 because lint was first run during the integration step)

---

**Total deviations:** 1 auto-fixed (Rule 3 — blocking lint failure)
**Impact on plan:** Zero impact on `must_haves`. The plan's canonical pattern was preserved byte-for-byte; only a focused single-line eslint-disable + explanatory comment was added. No alternative implementation, no scope creep, no additional dependencies.

## Issues Encountered

- **Build verification gate ran cleanly** — no parallel-wave race this time (Plan 04 in Wave 2 ran solo after Wave 1 completed)
- **Visual checkpoint (Task 4)** — user verified dark mode toggle, OS-preference default, palette tokens defined in DevTools computed styles, presenter mode behavior unchanged for chrome elements, ThemeToggle remains visible in presenter mode. User approved with "approved"

## User Setup Required

None — no env vars, secrets, or external service configuration. `next-themes` and `lucide-react` already in `package.json` from v1.0.

## Next Phase Readiness

**Ready for Phase 7+:**

- **Tailwind utilities live now:** `text-section-{inicio|bonos|payouts|tarjeta|clientes|recargas}`, `bg-section-*`, `border-section-*`; `text-status-{success|fail|pending}`, `bg-status-*`. Phase 7-10 use these directly without re-declaring tokens
- **Dark mode auto-applies** to v1.0 components: existing `dark:bg-*` / `dark:text-*` Tailwind classes resolve via the `.dark` class on `<html>`. Phase 7+ visual work focuses on light/dark contrast tuning per section, not dark-mode plumbing
- **Per-metric opt-out ready for Phase 9:** Vista Cliente CLI-V2-08 (timeline crudo) tags the timeline element with `data-presenter-metric-hide`. Internal KPIs in Vista Cliente do the same. Default behavior (visible) means Phase 9 only opts out the few that need hiding
- **Header layout frozen for v2.0:** 4 filters (DateRange / Empresa / Estado / Tipo) on the left + (LastRefresh / ThemeToggle / PresenterToggle / Salir) on the right. Phase 7-10 don't touch the header chrome

**Phase 6 closes here:**

- All 4 plans in Phase 6 complete (06-01 parsing API, 06-02 JOIN helper, 06-03 status/tipo filters, 06-04 dark mode + paleta + visibility)
- Cross-cutting infrastructure for v2.0 is shipped — Phase 7 (Bonos + Payouts unification) is unblocked

**Carry-forward concerns / non-blockers:**

- React 19 lint rule `react-hooks/set-state-in-effect` may bite future plans that adopt other "subscribe → setState" patterns. The eslint-disable lives only in `theme-toggle.tsx` for now; if more cases appear, consider a project-level config exception with documentation
- ThemeToggle staying visible in presenter mode is a deliberate trade-off — re-evaluate if user feedback says clients shouldn't see it
- The status/section palette aliasing (verde ≡ emerald, amarillo ≡ amber) is intentional for now; if Phase 7+ needs distinct status hues, decouple by introducing fresh `--status-*` oklch values

---
*Phase: 06-foundation-v2*
*Completed: 2026-05-07*
