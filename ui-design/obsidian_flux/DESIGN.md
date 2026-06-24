---
name: Obsidian Flux
colors:
  surface: '#0b1326'
  surface-dim: '#0b1326'
  surface-bright: '#31394d'
  surface-container-lowest: '#060e20'
  surface-container-low: '#131b2e'
  surface-container: '#171f33'
  surface-container-high: '#222a3d'
  surface-container-highest: '#2d3449'
  on-surface: '#dae2fd'
  on-surface-variant: '#c2c6d6'
  inverse-surface: '#dae2fd'
  inverse-on-surface: '#283044'
  outline: '#8c909f'
  outline-variant: '#424754'
  surface-tint: '#adc6ff'
  primary: '#adc6ff'
  on-primary: '#002e6a'
  primary-container: '#4d8eff'
  on-primary-container: '#00285d'
  inverse-primary: '#005ac2'
  secondary: '#b7c8e1'
  on-secondary: '#213145'
  secondary-container: '#3a4a5f'
  on-secondary-container: '#a9bad3'
  tertiary: '#ffb786'
  on-tertiary: '#502400'
  tertiary-container: '#df7412'
  on-tertiary-container: '#461f00'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#adc6ff'
  on-primary-fixed: '#001a42'
  on-primary-fixed-variant: '#004395'
  secondary-fixed: '#d3e4fe'
  secondary-fixed-dim: '#b7c8e1'
  on-secondary-fixed: '#0b1c30'
  on-secondary-fixed-variant: '#38485d'
  tertiary-fixed: '#ffdcc6'
  tertiary-fixed-dim: '#ffb786'
  on-tertiary-fixed: '#311400'
  on-tertiary-fixed-variant: '#723600'
  background: '#0b1326'
  on-background: '#dae2fd'
  surface-variant: '#2d3449'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  title-sm:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  code-md:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '450'
    lineHeight: 20px
  label-caps:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  container-padding: 24px
  gutter: 12px
  column-gap: 16px
  row-gap: 8px
---

## Brand & Style

This design system is engineered for high-stakes operational environments where clarity and rapid information processing are paramount. It adopts a **Corporate Modern** aesthetic with a strong emphasis on **Systematic Minimalism**. The interface prioritizes data over decoration, utilizing a structured layout that accommodates high information density without sacrificing legibility.

The target audience consists of DevOps engineers, SREs, and full-stack developers who require a tool that feels like a natural extension of their terminal and IDE. The UI evokes a sense of **precision, reliability, and technical authority**. Design decisions are driven by utility: maximizing screen real estate for logs, metrics, and complex relational data.

## Colors

The palette is anchored in a "DevOps Dark" aesthetic. The primary background uses a deep slate to reduce eye strain during long-term monitoring, while high-contrast borders and subtle surface elevations differentiate nested UI zones.

- **Primary:** An electric Azure blue for primary actions and active states.
- **Surface:** A spectrum of charcoals and slates (`#0F172A` to `#1E293B`) to define hierarchy.
- **Semantic Logic:** Color is used exclusively for signaling state. **Critical** (Ruby) denotes immediate action required, **Warning** (Amber) indicates threshold breaches, **Info** (Azure) marks neutral system events, and **Success** (Emerald) confirms resolution or health.
- **Data Visualization:** Use a distinct categorical palette for charts to ensure line differentiation, keeping saturations consistent with semantic signals.

## Typography

The typography system balances readability with compactness. **Inter** is the workhorse for all interface elements, chosen for its exceptional tall x-height and clarity at small sizes. **JetBrains Mono** is reserved for technical data, including exception stack traces, log entries, and code snippets.

- **Hierarchy:** Use `label-caps` for table headers and section titles to create clear visual separation without requiring large font sizes.
- **Density:** Body text defaults to `14px` for standard interactions and `12px` for dense data grids and sidebars.
- **Numerical Data:** Tabular figures (monospaced numbers) should be enabled via OpenType features in Inter for aligned data columns.

## Layout & Spacing

This design system utilizes a **Fixed Grid** philosophy for dashboard views and a **Fluid Content** model for log explorers. The layout is built on a strict 4px baseline grid to ensure mathematical alignment across complex nested components.

- **Dashboard Layout:** A 12-column grid with tight 12px gutters allows for maximum widget placement.
- **Side Navigation:** A fixed 240px sidebar for primary navigation, collapsible to 64px to reclaim horizontal space for data.
- **Information Density:** Vertical spacing is compressed. Row heights in data tables should be capped at 32px or 40px, using `row-gap: 8px` for list-based views.
- **Mobile Adaptivity:** On mobile, the 12-column grid collapses to 1 column. Sidebars transition to an overlay drawer. Complex tables should pivot to card-based summaries or enable horizontal scrolling with pinned key columns.

## Elevation & Depth

To maintain a technical, "glass-cockpit" feel, this design system eschews heavy shadows in favor of **Tonal Layers** and **Low-Contrast Outlines**.

- **Surface Tiers:**
    - `Level 0`: App background (`#0F172A`).
    - `Level 1`: Content cards, sidebars, and navigation rails.
    - `Level 2`: Input fields, dropdowns, and nested containers.
- **Borders:** Every container is defined by a subtle 1px border (`#1E293B` or `#334155`). 
- **Interactive States:** Hovering over a clickable surface should trigger a subtle background tint change rather than an elevation increase. 
- **Modals/Popovers:** Use a slight ambient shadow (15% opacity, no spread) to separate floating elements from the primary grid, accompanied by a backdrop blur (8px) to maintain context.

## Shapes

The shape language is **Soft** but disciplined. A 4px standard radius (`0.25rem`) is applied to buttons, input fields, and small UI components to provide a modern feel without appearing "playful."

- **Cards & Panes:** Use `rounded-lg` (8px) for major dashboard containers and KPI cards to subtly frame visualizations.
- **Buttons & Inputs:** Use the base 4px radius. 
- **Tags/Status Badges:** These may use a full pill shape (`rounded-full`) to distinguish them from interactive buttons.
- **Inner vs Outer:** When nesting elements (e.g., a button inside a card), ensure the inner radius is smaller or equal to the outer radius to maintain visual harmony.

## Components

- **KPI Cards:** Feature a `title-sm` header, a large display value, and a simplified sparkline (1px stroke) showing the 24h trend.
- **Data Tables:** High-density with sticky headers. Rows use alternating zebra-striping or subtle hover states. Column sorting and filtering icons appear only on hover or when active.
- **Buttons:** 
    - *Primary:* Solid Azure background, white text.
    - *Secondary:* Ghost style with 1px slate border.
    - *Action:* Small (28px height) for inline table actions.
- **Filter Bar:** A horizontal persistent bar above data views. Uses "pill-style" removable chips for active filters.
- **Status Indicators:** Small 8px circles (glyphs) using semantic colors, accompanied by a label. Avoid using icons alone to ensure accessibility.
- **Monospace Code Blocks:** Used for stack traces. Features syntax highlighting tailored to the dark slate palette, with line numbering and "copy to clipboard" functionality.
- **Nested Menus:** Vertical accordion-style navigation in the sidebar with 12px indentation per level.