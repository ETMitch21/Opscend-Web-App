# Opscend design standards — phase 1

Fuse is the single BuilderKit archetype. Read the licensed `.builderkit/skills/builderkit/guidelines.md` and the nearest Fuse page before designing a new screen. Use the existing application routes, permission checks, tenant context and API services. No mock server or sample data outside the design lab. Use the actual BuilderKit Material directives and variant vocabulary as migrated. Keep legacy Tailwind tokens until the last dependent view has been migrated; do not activate the vendor reset globally yet. Use semantic status colors, visible field labels, keyboard navigation and one primary action per context. Drawers require meaningful groups: no single-field tabs. Bulk actions must use stable record IDs and update only explicitly chosen fields. Public pages retain shop branding. New icons use modern Lucide; keep the legacy adapter until the last usage is migrated. No new package without an explicit decision; pin new packages.

## Dark-first visual standard

Use charcoal canvas #101113, restrained borders, compact typography and orange only for primary actions or active navigation. Prefer 6px control radii, 36–40px control heights and flat surfaces. Native selects on migrated screens must use `.ops-select`: remove the browser arrow, reserve 40px end padding and inset the custom 16px chevron 14px from the right edge. Preserve native keyboard interaction and forced-colors support. Status uses a small dot and text, not saturated pills. Keep contrast and visible focus in both schemes. Review dark and light examples before migrating each screen. Do not force dark styling onto legacy screens or public shop pages; migrate route by route.

## Compact actions and drawers
Primary action surface #ff9554, hover #ffa66f, pressed #ed8240, ink #20140e. No glow or gradient. Standard compact drawer width 400px; larger workflows may use wider drawers. Header 14px/16px, field gap 10px, footer 10px/16px, 34px minimum control height. Keep content scrollable and actions reachable. Migrate legacy drawers individually.

## Workspace navigation and select standard
Group routes by workflow, preserve permissions and feature flags, hide empty groups, and retain installed-app navigation. Keep location switching and operational header controls accessible. Use the approved `.ops-mat-select` trigger with its independent 16px masked chevron, 12px inset and centered rotation; do not restore the native Material arrow.
