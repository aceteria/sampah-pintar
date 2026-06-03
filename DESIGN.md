# EcoScan v2 — Design System

> AI-Powered Waste Classification Scanner · Nature-Inspired Premium UI

---

## 1. Brand Identity

| Property       | Value                                       |
|----------------|---------------------------------------------|
| **Name**       | EcoScan                                     |
| **Voice**      | Friendly, informative, eco-conscious        |
| **Palette**    | Warm earth tones + nature greens            |
| **Typography** | Outfit (display + body)                     |
| **Icon Style** | Phosphor-weight SVG line icons, stroke 16   |
| **Mood**       | Premium mobile-first, glassmorphism accents |

---

## 2. Design Tokens

### Colors

```
--bg:             #F5F0E8     (Warm Parchment)
--bg-card:        #FFFFFF
--bg-glass:       rgba(255, 255, 255, 0.72)
--glass-blur:     blur(16px)

--text-primary:   #2D3B2D     (Dark Forest)
--text-secondary: #6B7B6B     (Muted Sage)
--text-light:     #9EAB9E

--accent:         #4A7C59     (Deep Leaf Green)
--accent-hover:   #3A6347
--accent-light:   #A8D5BA     (Light Mint)
```

### Category Colors

| Category   | Token              | Hex       | Theme BG  | Theme Text |
|------------|--------------------|-----------|-----------|------------|
| Organik    | `--cat-organik`    | `#4A7C59` | `#E8F5E9` | `#1B5E20`  |
| Anorganik  | `--cat-anorganik`  | `#E0A96D` | `#FFF8E1` | `#B45F06`  |
| B3         | `--cat-b3`         | `#C75C5C` | `#FFEBEE` | `#B71C1C`  |

### Elevation

```
--shadow-sm:  0 2px 8px  rgba(45, 59, 45, 0.08)
--shadow-md:  0 8px 24px rgba(45, 59, 45, 0.12)
--shadow-lg:  0 20px 48px rgba(45, 59, 45, 0.16)
```

### Radii

```
--radius-sm:   12px
--radius-md:   20px
--radius-lg:   28px
--radius-pill: 999px
```

### Typography

```
Font Family: 'Outfit', system-fallback stack
Weights:     400 (body), 500 (medium), 600 (semi), 700 (bold), 800 (display)

Display:     4.5rem / 800 / -0.05em / 1.0 line-height  (mobile)
             6.5rem / 800 / -0.05em / 1.0 line-height  (desktop)
H1:          1.5rem / 800 / -0.03em / 1.2
Body:        1rem   / 400 / normal  / 1.6
Label:       0.75rem/ 700 / 0.08em  / uppercase
Small:       0.85rem/ 500 / 0.06em  / uppercase
```

---

## 3. Screen Architecture

```
┌─────────────┐      ┌──────────────┐      ┌──────────────┐
│   SPLASH    │─────▶│  CAMERA VIEW │─────▶│ RESULT VIEW  │
│   (entry)   │      │  (capture)   │      │  (analysis)  │
└─────────────┘      └──────┬───────┘      └──────┬───────┘
                            │                      │
                     ┌──────▼───────┐              │
                     │   LOADING    │              │
                     │  (overlay)   │──────────────┘
                     └──────┬───────┘
                            │
                     ┌──────▼───────┐
                     │    ERROR     │
                     │  (overlay)   │
                     └──────────────┘
```

All screens use `position: absolute` with `opacity` + `visibility` transitions (0.4s ease).

---

## 4. Screen Specifications

### 4.1 Splash Screen

**Layout:** Asymmetric Bento (mobile: stacked column, desktop: 50/50 split)
- **Left/Top:** Bold left-aligned display typography (`EcoScan` + tagline + CTA)
- **Right/Bottom:** 3 floating glass badges with perpetual CSS float animations
- **Background:** `linear-gradient(160deg, #F5F0E8 0%, #EBF5EE 100%)`
- **Entry animation:** `fadeUp 0.7s ease` on text section
- **Badge animations:** 3 independent float keyframes (6s, 7s, 8s) with subtle rotation

### 4.2 Camera Screen

**Layout:** Full-bleed camera feed with overlay UI
- **Header:** Absolute, gradient overlay (`rgba(0,0,0,0.4)` → transparent), logo + lang toggle
- **Scan Frame:** 260×260px centered, 4 corner brackets via `::before`/`::after` pseudo-elements with `scanPulse` animation
- **Controls:** Bottom gradient bar with hint text (glass pill), capture button (glassmorphic circle), upload label
- **Capture button:** 80×80px, 3px white border, inner 58px white circle, scale hover/active feedback

### 4.3 Result Screen

**Layout:** Scrollable vertical card layout with dynamic category theming
- **Header:** Fixed top bar with logo + lang toggle, subtle bottom border
- **Thumbnail + Meta:** Horizontal row — 100×100px rounded image + category badge (pill) + item name
- **Info Card:** Glass panel with 4px colored top accent bar, info rows for: decomposition time, impact, tips, confidence bar
- **Dynamic Theming:** Background and text colors adapt per category (green/amber/red)
- **Typography:** `dampak` and `tips` fields auto-parsed into formatted HTML lists
- **CTA:** Full-width secondary "Scan Again" button at bottom

### 4.4 Loading Overlay

- Semi-transparent warm overlay (`rgba(245,240,232,0.85)`) with heavy blur (20px)
- Image preview box (160×160px, rounded) with scanning laser line animation
- Rotating fun facts with opacity fade transitions (3.5s interval)

### 4.5 Error Overlay

- Same overlay base as Loading
- Glass panel card with SVG warning icon, error message, Retry + Cancel buttons

---

## 5. Animation System

| Name         | Duration | Easing         | Usage                    |
|--------------|----------|----------------|--------------------------|
| `float`      | 4s loop  | ease-in-out    | Splash hero icon         |
| `fadeUp`     | 0.7s     | ease           | Section entry reveals    |
| `slideUp`    | 0.5s     | ease           | Result container entry   |
| `scanLine`   | 2s loop  | ease-in-out    | Loading scanner laser    |
| `scanPulse`  | 2s loop  | ease-in-out    | Camera frame corners     |
| `floatBadge` | 6-8s     | ease-in-out    | Splash glass badges      |

**Principles:**
- All motion uses `transform` and `opacity` only (GPU-accelerated)
- No `setTimeout`-based animations; CSS keyframes or `requestAnimationFrame` only
- Transitions use `cubic-bezier` or `ease` curves; no `linear` easing

---

## 6. Component Library

### Buttons

| Variant     | Background          | Text    | Radius        | Shadow         |
|-------------|---------------------|---------|---------------|----------------|
| Primary     | `var(--accent)`     | White   | `--radius-pill`| green glow     |
| Secondary   | `var(--bg-card)`    | Primary | `--radius-pill`| `--shadow-sm`  |
| Ghost       | Transparent         | Secondary| none         | none           |
| Capture     | Glass (15% white)   | —       | 50%           | dark glow      |

### Glass Panel

```css
background: var(--bg-glass);
backdrop-filter: var(--glass-blur);
border: 1px solid rgba(255, 255, 255, 0.6);
box-shadow: var(--shadow-md);
border-radius: var(--radius-lg);
```

### Glass Badge (Splash)

```css
background: rgba(255, 255, 255, 0.4);
backdrop-filter: blur(12px);
border: 1px solid rgba(255, 255, 255, 0.6);
box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4),
            0 8px 32px rgba(45, 59, 45, 0.08);
border-radius: 24px;
```

### Glass Pill (Header)

```css
background: rgba(255, 255, 255, 0.15);
backdrop-filter: blur(8px);
border: 1px solid rgba(255, 255, 255, 0.25);
border-radius: var(--radius-pill);
```

### Category Badge

Dynamic pill with `color-mix()` background:
```css
color: var(--cat-{category});
background: color-mix(in srgb, var(--cat-{category}) 15%, transparent);
```

### Confidence Bar

```css
height: 8px;
background: rgba(0, 0, 0, 0.08);
border-radius: var(--radius-pill);

/* Fill animates width with cubic-bezier(0.4, 0, 0.2, 1) over 1.2s */
/* Color: green (HIGH), amber (MEDIUM), red (LOW) */
```

---

## 7. Responsive Breakpoints

| Breakpoint | Target      | Key Changes                                    |
|------------|-------------|------------------------------------------------|
| < 768px    | Mobile      | Single column, stacked splash, 260px scan frame|
| ≥ 768px    | Tablet/Desktop | Side-by-side splash, 540px result max-width, 300px scan frame |

---

## 8. Internationalization (i18n)

- **Languages:** Bahasa Indonesia (`id`), English (`en`)
- **Mechanism:** `data-i18n` attributes on DOM elements, JS-driven replacement
- **Toggle:** Glass pill button in camera + result headers
- **Persistence:** `localStorage` key `ecoscan_lang`

---

## 9. Backend Architecture

```
Browser ──POST /api/classify──▶ Vercel Serverless (api/classify.js)
                                    │
                                    ▼
                           NVIDIA NIM API
                    (nemotron-3-nano-omni-30b-a3b-reasoning)
                                    │
                                    ▼
                              JSON Response
                        (kategori, nama_benda,
                         waktu_terurai, dampak,
                         tips, confidence)
```

- API key stored exclusively in Vercel environment variables
- Regex cleanup strips markdown code fences from reasoning model output
- Prompt engineering enforces strict JSON-only responses with edge case handling

---

## 10. Anti-Patterns (Banned)

- No emojis in markup or code (use SVG icons)
- No `Inter` font (use `Outfit`)
- No purple/neon gradients
- No `h-screen` (use `min-h-[100dvh]` if needed)
- No `#000000` pure black (use `#2D3B2D` or similar)
- No generic centered hero layouts on desktop
