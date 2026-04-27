# EvoNash — AI Image Generation Style Guide

Use this style guide when generating images for the EvoNash project. Paste this entire document into your conversation with ChatGPT, Gemini, or any AI image generator to ensure visual consistency across all assets.

---

## Project Context

**EvoNash** is a 8th-grade science fair experiment platform that evolves populations of 1,000 neural-network-controlled organisms in a simulated biological environment called "The Petri Dish." It tests whether adaptive mutation rates help neural networks reach Nash Equilibrium faster than static mutation rates. The project blends **biology, game theory, and artificial intelligence**.

**Target audience:** Science fair judges, students, and educators.
**Tone:** Scientific but visually exciting. Futuristic but grounded in real biology.
**Live site:** https://sf.defouw.ca

---

## Visual Identity

### The Two Modes

The EvoNash project has **two visual contexts**. Images must match whichever context they're for:

1. **Dashboard / UI Context** — Clean, light, professional scientific dashboard (light gray background, white cards, indigo accents). Used for: screenshots, UI mockups, presentation slides alongside the dashboard.

2. **Illustration / Hero Context** — Dark, neon-glow, bioluminescent style (dark navy background, glowing organisms, circuit traces). Used for: hero banners, poster art, concept illustrations, the petri dish simulation.

**Most generated images will be in the Illustration/Hero style** since the dashboard UI is built in code.

---

### Color Palette

All images must use this exact palette. Do not introduce colors outside this system.

#### Primary Colors (Used Everywhere)
| Role | Color | Hex | Usage |
|------|-------|-----|-------|
| **Primary** | Indigo | `#6366F1` | Main accent, neural network nodes, UI elements |
| **Primary Deep** | Deep Indigo | `#4F46E5` | Hover states, depth, contrast |
| **Secondary** | Violet/Purple | `#8B5CF6` | Gradients paired with indigo, secondary highlights |
| **Tertiary** | Light Violet | `#A78BFA` | Soft glows, ambient light, gradient endpoints |

#### Illustration-Specific Colors
| Role | Color | Hex | Usage |
|------|-------|-----|-------|
| **Illustration BG** | Near-Black | `#0C0E14` | Dark backgrounds for hero art and illustrations |
| **Surface Dark** | Dark Navy | `#161923` | Panels, depth layers in dark illustrations |
| **Glow Cyan** | Cyan/Teal | `#06B6D4` | Energy, food pellets, data streams, life force |
| **Circuit Orange** | Orange/Amber | `#F59E0B` | Circuit traces, mutation, evolution markers |

#### Dashboard/UI Colors
| Role | Color | Hex | Usage |
|------|-------|-----|-------|
| **Page BG** | Light Gray | `#F8F9FB` | Dashboard page background |
| **Card BG** | White | `#FFFFFF` | Card and panel backgrounds |
| **Card Border** | Soft Gray | `#E2E5EC` | Subtle card borders |
| **Text Primary** | Near-Black | `#111827` | Headings and body text |
| **Text Secondary** | Medium Gray | `#4B5563` | Descriptions, labels |

#### Semantic Colors
| Role | Color | Hex | Usage |
|------|-------|-----|-------|
| **Success** | Emerald | `#10B981` | Convergence, "supported", online status |
| **Danger** | Red | `#EF4444` | Predation, projectiles, delete, energy loss |
| **Warning** | Amber | `#F59E0B` | Caution, mutation emphasis |
| **Control Badge** | Gray-Blue | `#6B7280` | "CONTROL" experiment group labels |
| **Experimental Badge** | Indigo | `#6366F1` | "EXPERIMENTAL" experiment group labels |
| **Running Badge** | Green | `#16A34A` | "RUNNING" status pills |

### Gradient Directions

Always use **135° diagonal gradients** (top-left to bottom-right):
- **Hero/Banner gradient:** `#6366F1` → `#8B5CF6` → `#A78BFA` — used for page header banners
- **Accent gradient:** `#6366F1` → `#06B6D4` (indigo to cyan) — used for illustration highlights
- **Evolution gradient:** `#F59E0B` → `#EF4444` (amber to red) — mutation/predation contexts
- **Text gradient:** `#6366F1` → `#8B5CF6` — used for gradient text effects on headings

---

## Art Style Rules

### Illustration / Hero Art Style
- **Dark background.** Use `#0C0E14` or very deep navy.
- **Neon bioluminescence.** Key elements have soft outer glows (indigo, cyan, or violet). Think glowing organisms in a dark ocean.
- **Clean and sharp.** Lines are crisp. No painterly textures, watercolor effects, or grunge.
- **Flat with depth.** Primarily flat/vector style but with subtle glows, gradients, and soft shadows. NOT photorealistic, NOT cartoon.
- **Grid/hex overlay.** Backgrounds include faint hexagonal grids or circuit-board traces at ~5% opacity.
- **Decorative cross pattern.** Hero banners in the UI use a subtle repeating `+` cross pattern at ~5% white opacity over the gradient.

### Dashboard Context Style
- **Light and airy.** Light gray (`#F8F9FB`) backgrounds, white cards with subtle 1px borders.
- **Rounded corners.** All cards use 12px border radius.
- **Subtle shadows.** Cards have very soft box shadows for depth.
- **Indigo accents.** Active states, links, and interactive elements use indigo (`#6366F1`).
- **Pill badges.** Status indicators are rounded pill shapes (e.g., green "RUNNING", indigo "EXPERIMENTAL", gray "CONTROL").
- **Clean data tables.** Worker lists and experiment lists use clean rows with subtle dividers.

### Do NOT Use
- Bright white backgrounds in illustrations (only for dashboard context)
- Photorealistic 3D rendering
- Cartoon, chibi, or anime styles
- Watercolor, oil paint, or hand-drawn textures
- Stock photo aesthetics
- Clip art or flat emoji-style icons
- Gradients outside the palette above
- Busy, cluttered compositions
- Thick borders or outlines

---

## Recurring Visual Motifs

Use these elements consistently across illustrations:

| Motif | Description | When to Use |
|-------|-------------|-------------|
| **Petri Dish** | A glowing circular boundary (indigo/violet rim glow) viewed from top-down, containing organisms. The boundary is a thin luminous ring, not a thick border. | Hero images, overview diagrams, simulation context |
| **Neural Network** | Small glowing circles connected by thin luminous lines. Architecture: 24 input → 64 hidden → 4 output. Input nodes are cyan, hidden nodes are indigo, output nodes are violet. | Architecture diagrams, AI explanations |
| **Organisms/Agents** | Small glowing circles with motion trails (comet-like streaks). Colored indigo or cyan. Some fire thin red projectile lines. They consume small green/cyan food dots. | Simulation visuals, petri dish scenes |
| **Circuit Traces** | Thin orange (`#F59E0B`) and indigo lines branching like PCB traces. | Background decoration in dark illustrations |
| **Hexagonal Grid** | Faint honeycomb pattern at ~5% opacity. | Dark illustration backgrounds, inside the petri dish |
| **Cross Pattern** | Repeating `+` shapes at ~5% white opacity over gradients. | Hero banner overlays (matches the live site exactly) |
| **DNA/Helix** | Stylized double helix made of dots and lines (not photorealistic). Indigo/violet colored. | Mutation, genetics, evolution contexts |
| **Convergence Paths** | Lines/paths that start scattered and chaotic, gradually converging to a single bright point. | Nash equilibrium, convergence visuals |
| **Energy Rings** | Concentric glowing rings around organisms, pulsing from bright (full energy) to dim (depleted). | Energy, fitness, metabolism |
| **Colored Side Borders** | Sections on the overview page use a thick left-side color accent bar (indigo, green, amber, red) alongside white cards. | Content sections, information hierarchy |

---

## The Live Simulation View

The actual in-game simulation uses a specific minimalist style:
- **Dark canvas** background (deep navy/slate)
- **Agents** are solid blue circles with a white directional line indicating heading
- **Food pellets** are small green dots
- **Projectiles** are small red dots
- **No glow effects** in the simulation itself — it's geometric and clean
- This is different from the *artistic* petri dish illustration, which is more decorative

When illustrating the simulation conceptually (for posters/presentations), use the **neon glow** artistic style. When showing actual simulation output, match the geometric minimalist style.

---

## Typography in Images

When text appears in generated images:

- **Font style:** Clean, modern sans-serif (Inter, Roboto, or similar). No serifs, no handwriting, no decorative fonts.
- **Title text:** Bold/800 weight, with either a subtle indigo-to-violet gradient fill or pure white with a soft glow.
- **Label text:** Regular/400 weight, off-white (`#F1F5F9`) on dark backgrounds or medium gray (`#4B5563`) on light backgrounds.
- **Monospace:** For technical values like seeds, UUIDs, generation numbers.
- **Avoid** putting large blocks of text in images. Keep it to titles, short labels, or single keywords.

---

## Composition Guidelines

1. **Generous negative space.** Don't crowd the frame. Let elements breathe.
2. **Center-focused.** Main subject centered or slightly off-center with supporting elements radiating outward.
3. **Layered depth.** Background (grid/hexes at low opacity) → Midground (circuit traces, ambient particles) → Foreground (main subject with glow).
4. **Aspect ratios:**
   - Square (`1:1`) for social media, thumbnails, and science fair board sections
   - Wide (`16:9`) for presentation slides and website banners
   - Tall (`9:16`) for posters and vertical displays

---

## Example Prompts

### Hero/Banner Image (Dark Illustration Style)
> A dark futuristic petri dish viewed from above, glowing indigo and violet rim, containing small bioluminescent organisms with cyan motion trails swimming among green food dots. Faint hexagonal grid overlay on the background. Circuit board traces in orange along the edges. Dark navy-black background (#0C0E14). Clean digital art style with neon glows. No text.

### Neural Network Diagram
> A stylized neural network diagram on a dark background (#0C0E14). 24 input nodes on the left (small cyan dots), connected by thin luminous lines to 64 hidden nodes in the middle (indigo glowing circles), then to 4 output nodes on the right (violet circles). Soft glows around each node. Faint hexagonal grid in the background at 5% opacity. Clean vector style.

### Evolution/Mutation Concept
> An abstract visualization of genetic mutation. A glowing DNA double helix made of indigo and violet dots transitions from chaotic/scattered connections on the left (high mutation, orange/amber glow) to organized/stable connections on the right (low mutation, calm indigo glow). Dark background with faint circuit traces. Clean digital art style.

### Convergence to Nash Equilibrium
> Multiple scattered glowing paths (indigo and cyan particle trails) on a dark background that gradually converge toward a single bright point of light (white/violet glow) at the center. The paths start chaotic and wide on the left and become organized and narrow toward the right. Faint grid lines in the background. Clean futuristic style.

### Science Fair Board Section — Petri Dish
> A top-down view of a circular petri dish arena on a dark background. Inside, ~20 small glowing organisms (indigo circles with cyan tails) navigate around scattered food pellets (small green/cyan dots). Some organisms fire thin red projectile lines. The dish has a glowing violet rim. Outside the dish, faint circuit board traces in orange. Clean digital illustration.

### Presentation Slide Background
> A subtle, clean background for a presentation slide. Light gray (#F8F9FB) base with a very faint hexagonal grid pattern at 3% opacity. A thin indigo-to-violet gradient strip along the top edge. Minimal and professional. No text, no illustrations — just an elegant backdrop.

---

## Reference Image

The existing project hero image (petri-dish.png) establishes the baseline illustration style:
- Dark background with circuit board traces in orange
- Glowing circular petri dish with bioluminescent organisms
- Neon cyan, indigo, violet, and orange color scheme
- Top-down perspective for the petri dish
- Clean digital art with glow effects — not photorealistic

The live dashboard (sf.defouw.ca) establishes the UI style:
- Light gray page background with white cards
- Indigo-to-purple gradient hero banners with a subtle cross (+) pattern overlay
- Pill-shaped status badges (green RUNNING, indigo EXPERIMENTAL, gray CONTROL)
- Clean data tables with subtle row dividers
- Inter font throughout
- 12px rounded corners on all cards

**All new images should feel like they belong in the same world as these existing assets.**

---

## Quick Checklist

Before finalizing any image, verify:

- [ ] **Illustration?** Background is dark (`#0C0E14` or deep navy)
- [ ] **Dashboard context?** Background is light (`#F8F9FB` with white cards)
- [ ] Primary colors are indigo (`#6366F1`) / violet (`#8B5CF6`) / cyan (`#06B6D4`)
- [ ] No random blues, teals, or greens outside the palette
- [ ] Has subtle glow effects (illustrations) or subtle shadows (dashboard)
- [ ] Clean digital/vector style — not painterly, not cartoon, not photorealistic
- [ ] Composition isn't cluttered — has generous breathing room
- [ ] Consistent with the existing petri-dish.png hero image aesthetic
- [ ] Text (if any) uses clean sans-serif font, not decorative
