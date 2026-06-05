# Task Management Widget — UI Design Guide

> **Scope**: Spacing, layout structure, card chrome, and dark-mode rules for all channel widget views.  
> **Token source**: [`src/ui/widget-layout.css`](./widget-layout.css) — `:root` block.  
> **Do not** hard-code any spacing, radius, border, or shadow value in a widget-specific CSS file. Reference the `--tm-*` tokens instead.

---

## 1. Design Tokens

All values live in the `:root` block of `widget-layout.css`.

### Spacing

| Token | Value | Usage |
|---|---|---|
| `--tm-space-1` | 4 px | Micro gaps (badge padding, dot, inline icon spacing) |
| `--tm-space-2` | 8 px | **Standard gutter** — shell padding, column gap, row gap |
| `--tm-space-3` | 12 px | View-panel row gap; card section padding (H) |
| `--tm-space-4` | 16 px | Case-detail outer padding; large section gaps |
| `--tm-gutter` | `--tm-space-2` (8 px) | Outer padding of every view/widget root |
| `--tm-row-gap` | `--tm-space-2` (8 px) | Vertical gap between rows inside a widget-shell |
| `--tm-view-gap` | `--tm-space-3` (12 px) | Vertical gap between sections inside a view-panel |
| `--tm-col-gap` | `--tm-space-2` (8 px) | Horizontal gap between grid columns in widget-body |
| `--tm-panel-padding` | `10px 12px` | Inner padding of panel headers and rail-card content |

### Card chrome

| Token | Value |
|---|---|
| `--tm-radius-sm` | 6 px |
| `--tm-radius-md` | 8 px (standard card) |
| `--tm-radius-lg` | 10 px (analytics bar) |
| `--tm-border-card` | `1px solid var(--md-color-gray-20)` |
| `--tm-shadow-card` | `0 1px 3px rgba(0,0,0,.06)` |
| `--tm-shadow-bar` | `0 1px 4px rgba(0,0,0,.06)` |

### Surfaces

| Token | Light | Dark |
|---|---|---|
| `--tm-bg-shell` | `#f4f5f7` | `#1a1a2e` |
| `--tm-bg-panel` | `#ffffff` | `#2d2d2d` |
| `--tm-bg-rail` | `#f8f9fa` | — |
| `--tm-border-dark` | — | `rgba(255,255,255,.08)` |

---

## 2. Layout Model

### Golden rule

Every view and widget root must carry exactly **one** of:

| Root class | Used by | Outer padding | Row gap |
|---|---|---|---|
| `.widget-shell` | Multi-column channel widgets (email, chat, voice) | `--tm-gutter` (8 px) | `--tm-row-gap` (8 px) |
| `.view-panel` | Single-column tab views (cases, history) | `--tm-gutter` (8 px) | `--tm-view-gap` (12 px) |

Both use the **same 8 px outer gutter**. Every direct child — analytics collapse, header bar, and column grid — will align to the same 8 px inset from the widget edge.

```
┌─ widget-shell ─────────────────────────────────────────────────┐
│ 8px gutter on all sides                                         │
│  ┌─ analytics-collapse ──────────────────────────────────────┐  │
│  │ toggle button + collapsible analytics bar                  │  │
│  └────────────────────────────────────────────────────────────┘  │
│  ╌╌ row gap 8px ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌  │
│  ┌─ widget-header-bar ───────────────────────────────────────┐  │
│  │ task / session info strip                                  │  │
│  └────────────────────────────────────────────────────────────┘  │
│  ╌╌ row gap 8px ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌  │
│  ┌─ widget-body ───────────────────────────────────────────┐    │
│  │  NO extra padding (columns start at shell's 8px gutter) │    │
│  │  ┌─ col 1 ─┐  gap  ┌─ col 2 ────────────┐  gap  ┌─ col 3 ─┐ │
│  │  │ panel   │  8px  │ panel / transcript  │  8px  │  rail   │ │
│  │  └─────────┘       └────────────────────┘       └─────────┘ │
│  └────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

### widget-body rules

- **No padding** — the parent `widget-shell` provides the outer gutter.  
- Only sets `gap: var(--tm-col-gap)` between columns.  
- Each widget sets its own `grid-template-columns` via a widget-specific selector.

```css
/* correct */
.chat-widget__body  { grid-template-columns: 220px 1fr 268px; }
.voice__body        { grid-template-columns: 180px 1fr 260px; }
.email-widget__body--3col { grid-template-columns: 280px 1fr 320px; }
```

---

## 3. Class Catalogue

### Shell / root classes

| Class | File | Purpose |
|---|---|---|
| `.widget-shell` | `widget-layout.css` | Root of every channel widget |
| `.view-panel` | `widget-layout.css` | Root of every single-column view |
| `.tm-view-mount` | `widget-layout.css` | Full-size wrapper in routed view slots |

### Multi-column layout

| Class | File | Purpose |
|---|---|---|
| `.widget-body` | `views.css` | 3-col grid, inherits gutter from parent widget-shell |
| `.widget-panel` | `widget-layout.css` | Column card chrome (white bg, border, radius, shadow) |
| `.widget-panel__header` | `widget-layout.css` | Uppercase panel title bar |
| `.widget-panel__subheader` | `widget-layout.css` | Section label inside a rail |
| `.widget-rail` | `widget-layout.css` | Scrollable AI/assist right column |
| `.widget-rail-card` | `widget-layout.css` | Individual card inside a rail |
| `.widget-rail-card__content` | `widget-layout.css` | Inner padding for rail card body |

### Header / task strip

| Class | File | Purpose |
|---|---|---|
| `.widget-header-bar` | `widget-layout.css` | Session/task strip below analytics bar |

### Analytics

| Class | File | Purpose |
|---|---|---|
| `.analytics-collapse` | `views.css` | Collapsible wrapper (toggle + bar) |
| `.analytics-bar` | `views.css` | Horizontally scrollable metrics bar |
| `.analytics-section` | `views.css` | Individual metric section inside the bar |

### Case / history content

| Class | File | Purpose |
|---|---|---|
| `.case-detail` | `views.css` | Root of the default case editor view |
| `.case-detail__*` | `views.css` | All sub-elements (fields, items, actions, …) |
| `.cases-view__*` | `views.css` | Cases-specific card and list elements |
| `.history-view__*` | `views.css` | History timeline elements |

---

## 4. Dark Mode

Apply `.md--dark` to the widget root only. All shared classes handle their own dark overrides:

```jsx
// ✓ correct — dark class on root only
<div className={`chat-widget widget-shell${darkMode ? ' md--dark' : ''}`}>

// ✗ wrong — don't cascade dark through children manually
<div className="chat-widget__conversations widget-panel md--dark">
```

Widget-specific CSS may add `.md--dark .widget-name__element` rules for colours that are unique to that widget (e.g. voice sentiment colours). The structural chrome (background, border, shadow) is always handled by the shared class rules.

---

## 5. Inline Style Policy

### Allowed

Inline styles are **only** allowed when the value is **dynamic at runtime** and cannot be expressed as a CSS class:

```jsx
// ✓ runtime colour from data
<span style={{ background: sentimentColor }} />

// ✓ CSS custom property bridging (dynamic channel colour)
<div style={{ '--ch-color': channelColor }} />

// ✓ SVG animation attribute (not a CSS property)
<circle style={{ transition: 'stroke-dasharray 0.4s ease' }} />
```

### Forbidden

```jsx
// ✗ hard-coded layout
<div style={{ display: 'flex', gap: 8, marginTop: 4 }} />

// ✗ spacing that belongs in a named class
<div style={{ padding: '10px 12px' }} />

// ✗ sizing that belongs in a named class
<div style={{ height: '100%', width: '100%' }} />
```

If you need a new spacing combination that doesn't map to an existing class, **add the class** to the appropriate CSS file (`widget-layout.css` if shared, `views.css` if view-specific, widget CSS if widget-specific).

---

## 6. Adding a New View or Widget

### New single-column tab view

1. Root div: `className={`view-panel${darkMode ? ' md--dark' : ''}`}`  
2. Import `widget-layout.css` is already included via `TaskManagement.jsx`.  
3. Add view-specific child styles to `views.css`.  
4. Route it via `TaskManagement.jsx` with a `<div className="tm-view-mount …">` wrapper.

### New multi-column channel widget

1. Root div: `className={`widget-name widget-shell${darkMode ? ' md--dark' : ''}`}`  
2. Create `src/widget-name/widget-name.css`, import it in the widget component.  
3. Add `widget-name.css`:

```css
/* root — only widget-specific non-layout properties */
.widget-name { overflow: hidden; /* if needed */ }

/* column layout */
.widget-name__body { grid-template-columns: …px 1fr …px; }

/* widget-specific component styles below */
```

4. Use `.widget-shell`, `.widget-body`, `.widget-panel`, `.widget-header-bar`, `.widget-rail`, `.widget-rail-card` from shared files — never redefine their chrome in widget CSS.

---

## 7. Checklist Before PR

- [ ] No spacing value hard-coded in a widget CSS file — uses `--tm-*` tokens or inherits from shared class
- [ ] No inline `style={{ … }}` except for runtime-dynamic values
- [ ] Root div carries `.widget-shell` (widget) or `.view-panel` (view)
- [ ] `widget-body` child has `grid-template-columns` override but **no** `padding` or `gap` override
- [ ] Dark mode applied only via `.md--dark` on the root
- [ ] Momentum component overrides layer **on top of** Momentum tokens, not below
- [ ] Verified visually: analytics bar left edge aligns with column panel left edges
