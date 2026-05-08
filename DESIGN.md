# Design System: EduNest — Kindergarten & School Management App

## 1. Visual Theme & Atmosphere

EduNest is a warm, trustworthy, and approachable platform built for parents,
teachers, and school administrators. The visual language draws from the calm
confidence of modern SaaS tools (Linear, Notion) but softens them with warm
tones that feel safe and human — appropriate for an app handling children's
daily lives.

The design operates on a light-first canvas: soft warm-white backgrounds
(`#FAFAF8`) with gentle slate surfaces. The primary accent is a rich indigo
(`#4F46E5`) that signals clarity and professionalism, paired with a warm teal
(`#0D9488`) for positive states (attendance present, payment confirmed, daily
report received). The overall impression is: clean institution, warm heart.

Three distinct portal personalities share the same design system:
- **Admin portal**: data-dense, structured, information-rich — closer to Linear
- **Teacher portal**: task-focused, quick actions, daily workflow
- **Parent portal**: warm, feed-like, emotionally reassuring — closer to Notion

Typography is built on Inter for UI and data, with slightly relaxed tracking
for readability across Arabic (RTL) and French (LTR) content. All layouts
support RTL switching via `dir="rtl"` on the `<html>` element.

**Key characteristics:**
- Light-first: `#FAFAF8` page background, `#FFFFFF` card surfaces
- Warm-neutral base: slate grays with a slight warm undertone
- Indigo primary (`#4F46E5`) — precise, trustworthy, action-oriented
- Teal success (`#0D9488`) — calm positive feedback
- Amber warning (`#D97706`) — late attendance, pending states
- Red danger (`#DC2626`) — absent, overdue, destructive actions
- 4px base unit grid — generous spacing, no cramped layouts
- 8px border radius default — friendly without being childish
- Thin 1px borders (`#E2E8F0`) — structure without heaviness
- Inter Variable for all text — clean, multilingual, highly legible

---

## 2. Color Palette & Roles

### Background Surfaces
- **Page background** (`#FAFAF8`): Warm off-white — the base canvas for all portals
- **Card surface** (`#FFFFFF`): Pure white for raised cards and panels
- **Subtle surface** (`#F1F5F9`): Light slate for secondary panels, sidebars, input backgrounds
- **Hover surface** (`#F8FAFC`): Near-invisible hover state for list rows and table rows
- **Overlay** (`rgba(15, 23, 42, 0.5)`): Modal/dialog backdrop — dark slate

### Primary — Indigo
- **Indigo 600** (`#4F46E5`): Primary buttons, active nav, key CTAs
- **Indigo 700** (`#4338CA`): Button hover states
- **Indigo 500** (`#6366F1`): Links, focus rings, accent text
- **Indigo 100** (`#E0E7FF`): Badge backgrounds, subtle highlights
- **Indigo 50** (`#EEF2FF`): Very subtle tints on selected rows

### Teal — Success & Positive
- **Teal 600** (`#0D9488`): Present attendance, paid invoice, confirmed action
- **Teal 500** (`#14B8A6`): Success icons, positive trend indicators
- **Teal 100** (`#CCFBF1`): Success badge backgrounds
- **Teal 50** (`#F0FDFA`): Success alert backgrounds

### Amber — Warning & Pending
- **Amber 600** (`#D97706`): Late attendance, pending consent, due-soon invoice
- **Amber 500** (`#F59E0B`): Warning icons
- **Amber 100** (`#FEF3C7`): Warning badge backgrounds
- **Amber 50** (`#FFFBEB`): Warning alert backgrounds

### Red — Danger & Absent
- **Red 600** (`#DC2626`): Absent attendance, overdue invoice, destructive actions
- **Red 500** (`#EF4444`): Error states, delete buttons on hover
- **Red 100** (`#FEE2E2`): Error badge backgrounds
- **Red 50** (`#FEF2F2`): Error alert backgrounds

### Neutral — Slate (warm-toned)
- **Slate 900** (`#0F172A`): Page titles, critical headings
- **Slate 700** (`#334155`): Primary body text, nav labels
- **Slate 500** (`#64748B`): Secondary text, placeholders, metadata
- **Slate 400** (`#94A3B8`): Disabled text, subtle hints
- **Slate 300** (`#CBD5E1`): Disabled borders, subtle dividers
- **Slate 200** (`#E2E8F0`): Default borders, table dividers
- **Slate 100** (`#F1F5F9`): Secondary surface fills
- **Slate 50** (`#F8FAFC`): Hover row backgrounds

### Semantic Token Map
```
--color-bg-page:          #FAFAF8
--color-bg-card:          #FFFFFF
--color-bg-subtle:        #F1F5F9
--color-bg-hover:         #F8FAFC
--color-border:           #E2E8F0
--color-border-strong:    #CBD5E1
--color-text-primary:     #334155
--color-text-secondary:   #64748B
--color-text-heading:     #0F172A
--color-text-disabled:    #94A3B8
--color-text-inverse:     #FFFFFF
--color-accent:           #4F46E5
--color-accent-hover:     #4338CA
--color-accent-muted:     #E0E7FF
--color-success:          #0D9488
--color-success-muted:    #CCFBF1
--color-warning:          #D97706
--color-warning-muted:    #FEF3C7
--color-danger:           #DC2626
--color-danger-muted:     #FEE2E2
--color-present:          #0D9488
--color-absent:           #DC2626
--color-late:             #D97706
--color-paid:             #0D9488
--color-overdue:          #DC2626
--color-pending:          #D97706
```

---

## 3. Typography Rules

### Font Families
- **Primary UI**: `Inter Variable`, fallback: `-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`
- **Arabic (RTL)**: `"Noto Sans Arabic", Inter Variable, system-ui, sans-serif`
- **Monospace** (IDs, amounts, codes): `"JetBrains Mono", "Fira Code", ui-monospace, monospace`

### Type Scale

| Role             | Size     | Weight | Line Height | Letter Spacing | Usage                          |
|------------------|----------|--------|-------------|----------------|--------------------------------|
| Display          | 30px     | 700    | 1.20        | -0.5px         | Login hero, onboarding titles  |
| Page title       | 24px     | 600    | 1.25        | -0.3px         | Dashboard, module page titles  |
| Section heading  | 20px     | 600    | 1.30        | -0.2px         | Card headers, section labels   |
| Subsection       | 16px     | 600    | 1.40        | normal         | Table column headers, subheads |
| Body large       | 15px     | 400    | 1.60        | normal         | Descriptions, form help text   |
| Body             | 14px     | 400    | 1.60        | normal         | Primary UI text, table cells   |
| Body medium      | 14px     | 500    | 1.60        | normal         | Nav labels, emphasized body    |
| Label            | 13px     | 500    | 1.40        | 0.1px          | Form labels, badge text        |
| Caption          | 12px     | 400    | 1.40        | normal         | Timestamps, metadata           |
| Caption medium   | 12px     | 500    | 1.40        | normal         | Status chips, mini labels      |
| Micro            | 11px     | 500    | 1.30        | 0.2px          | Overlines, tiny tags           |
| Mono amount      | 14px     | 500    | 1.40        | normal         | Invoice amounts, IDs, codes    |

### Principles
- **No font below 11px** — accessibility and multilingual legibility
- **Arabic content**: use `font-feature-settings: "kern" 1` and increase line-height to 1.8 for Arabic
- **Heading weights are 600–700 only** — never 800 or 900, too heavy for a warm UI
- **Body text is always 400 or 500** — no 300 light weight in UI context
- **Amounts and IDs in monospace** — financial data, student IDs, invoice numbers

---

## 4. Component Styles

### Buttons

**Primary button**
```css
background: #4F46E5;
color: #FFFFFF;
padding: 8px 16px;
border-radius: 8px;
font-size: 14px;
font-weight: 500;
border: none;
cursor: pointer;
transition: background 150ms ease;
hover: background #4338CA;
active: transform scale(0.98);
focus: box-shadow 0 0 0 3px rgba(99,102,241,0.3);
```

**Secondary button**
```css
background: #FFFFFF;
color: #334155;
padding: 8px 16px;
border-radius: 8px;
font-size: 14px;
font-weight: 500;
border: 1px solid #E2E8F0;
hover: background #F8FAFC; border-color #CBD5E1;
```

**Danger button**
```css
background: #FFFFFF;
color: #DC2626;
border: 1px solid #FEE2E2;
hover: background #FEF2F2; border-color #DC2626;
```

**Ghost / icon button**
```css
background: transparent;
color: #64748B;
padding: 6px 8px;
border-radius: 6px;
border: none;
hover: background #F1F5F9; color #334155;
```

**Sizes**
- sm: `padding: 5px 12px; font-size: 13px; border-radius: 6px`
- md: `padding: 8px 16px; font-size: 14px; border-radius: 8px` ← default
- lg: `padding: 10px 20px; font-size: 15px; border-radius: 8px`

### Inputs & Forms

**Text input**
```css
background: #FFFFFF;
border: 1px solid #E2E8F0;
border-radius: 8px;
padding: 8px 12px;
font-size: 14px;
color: #334155;
placeholder-color: #94A3B8;
focus: border-color #4F46E5; box-shadow 0 0 0 3px rgba(79,70,229,0.12);
error: border-color #DC2626; box-shadow 0 0 0 3px rgba(220,38,38,0.12);
```

**Form label**
```css
font-size: 13px;
font-weight: 500;
color: #334155;
margin-bottom: 4px;
display: block;
```

**Helper / error text**
```css
font-size: 12px;
color: #64748B; /* helper */
color: #DC2626; /* error */
margin-top: 4px;
```

**Select / dropdown**
- Same as text input + chevron icon right-aligned
- Option hover: `background #EEF2FF; color #4338CA`

**Field group spacing**: `margin-bottom: 16px` between fields

### Cards

**Default card**
```css
background: #FFFFFF;
border: 1px solid #E2E8F0;
border-radius: 12px;
padding: 20px;
```

**Interactive card (hover)**
```css
+ transition: box-shadow 150ms ease, border-color 150ms ease;
hover: border-color #CBD5E1; box-shadow 0 4px 12px rgba(15,23,42,0.06);
cursor: pointer;
```

**Stat / KPI card**
```css
background: #F8FAFC;
border-radius: 10px;
padding: 16px;
/* no border — uses background contrast only */
```

**Alert / info card**
```css
border-radius: 8px;
padding: 12px 16px;
border-left: 3px solid <semantic-color>;
/* info:    background #EEF2FF;  border #4F46E5 */
/* success: background #F0FDFA;  border #0D9488 */
/* warning: background #FFFBEB;  border #D97706 */
/* danger:  background #FEF2F2;  border #DC2626 */
```

### Badges & Status Pills

**Attendance status**
```css
/* Present */
background: #CCFBF1; color: #0D9488; border-radius: 9999px; padding: 2px 8px; font-size: 12px; font-weight: 500;
/* Absent */
background: #FEE2E2; color: #DC2626;
/* Late */
background: #FEF3C7; color: #D97706;
```

**Invoice status**
```css
/* Paid */    background: #CCFBF1; color: #0D9488;
/* Sent */    background: #E0E7FF; color: #4F46E5;
/* Overdue */ background: #FEE2E2; color: #DC2626;
/* Draft */   background: #F1F5F9; color: #64748B;
/* Cancelled*/background: #F1F5F9; color: #94A3B8;
```

**Role badge**
```css
/* Admin */   background: #EDE9FE; color: #5B21B6; font-size: 11px; font-weight: 500; padding: 2px 6px; border-radius: 4px;
/* Teacher */ background: #DBEAFE; color: #1D4ED8;
/* Parent */  background: #FCE7F3; color: #9D174D;
```

### Navigation

**Sidebar (Admin & Teacher portals)**
```css
width: 220px;
background: #FFFFFF;
border-right: 1px solid #E2E8F0;
padding: 16px 8px;
```

**Nav item**
```css
display: flex; align-items: center; gap: 8px;
padding: 8px 12px;
border-radius: 8px;
font-size: 14px; font-weight: 500;
color: #64748B;
cursor: pointer;
transition: all 150ms ease;

hover:  background #F1F5F9; color #334155;
active: background #EEF2FF; color #4F46E5;
active: left border 2px solid #4F46E5 (optional accent line);
```

**Top bar (Parent portal)**
```css
height: 56px;
background: #FFFFFF;
border-bottom: 1px solid #E2E8F0;
padding: 0 16px;
display: flex; align-items: center; justify-content: space-between;
```

### Tables

**Table container**
```css
background: #FFFFFF;
border: 1px solid #E2E8F0;
border-radius: 12px;
overflow: hidden;
```

**Table header**
```css
background: #F8FAFC;
border-bottom: 1px solid #E2E8F0;
font-size: 12px; font-weight: 500;
color: #64748B;
text-transform: uppercase;
letter-spacing: 0.05em;
padding: 10px 16px;
```

**Table row**
```css
border-bottom: 1px solid #F1F5F9;
padding: 12px 16px;
font-size: 14px; color: #334155;
hover: background #F8FAFC;
```

### Avatars

**Child / user avatar**
```css
border-radius: 50%;
object-fit: cover;
/* sizes: 24px (micro), 32px (table), 40px (card), 56px (profile) */
```

**Initials avatar (fallback)**
```css
background: #EEF2FF;
color: #4F46E5;
font-size: 14px; font-weight: 600;
border-radius: 50%;
display: flex; align-items: center; justify-content: center;
```

### Chat / Messaging

**Message bubble — teacher sent**
```css
background: #4F46E5;
color: #FFFFFF;
border-radius: 16px 16px 4px 16px;
padding: 10px 14px;
font-size: 14px;
max-width: 75%;
align-self: flex-end;
```

**Message bubble — parent received**
```css
background: #F1F5F9;
color: #334155;
border-radius: 16px 16px 16px 4px;
padding: 10px 14px;
max-width: 75%;
align-self: flex-start;
```

**Message timestamp**
```css
font-size: 11px; color: #94A3B8;
margin-top: 2px;
```

**Read receipt indicator**
```css
width: 14px; height: 14px;
color: #0D9488; /* read */
color: #94A3B8; /* sent but unread */
```

### Daily Report Card (Parent Portal)

```css
/* The signature component of the parent portal */
background: #FFFFFF;
border: 1px solid #E2E8F0;
border-radius: 16px;
padding: 20px;
margin-bottom: 16px;

/* Mood indicator strip at top */
border-top: 4px solid <mood-color>;
/* happy:   #0D9488 */
/* excited: #4F46E5 */
/* calm:    #64748B */
/* tired:   #D97706 */
/* sad:     #DC2626 */

/* Photo grid */
display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;
border-radius: 8px; overflow: hidden;
```

### Modals & Dialogs

```css
/* Overlay */
background: rgba(15, 23, 42, 0.5);
backdrop-filter: blur(2px);

/* Modal panel */
background: #FFFFFF;
border-radius: 16px;
padding: 24px;
max-width: 480px; width: 90vw;
box-shadow: 0 20px 60px rgba(15, 23, 42, 0.15);

/* Modal header */
font-size: 18px; font-weight: 600; color: #0F172A;
margin-bottom: 4px;

/* Modal subtitle */
font-size: 14px; color: #64748B;
margin-bottom: 20px;

/* Footer actions — right-aligned */
display: flex; justify-content: flex-end; gap: 8px;
margin-top: 24px;
padding-top: 16px;
border-top: 1px solid #F1F5F9;
```

---

## 5. Layout Principles

### Spacing Scale (4px base unit)
```
1:  4px   — icon-to-text gap, tight internal padding
2:  8px   — compact internal padding, small gaps
3:  12px  — standard icon padding, small card padding
4:  16px  — default content padding, list item padding
5:  20px  — card padding, section gaps
6:  24px  — section padding, modal padding
8:  32px  — between major sections
10: 40px  — page-level vertical rhythm
12: 48px  — large section spacing
16: 64px  — hero/banner spacing
```

### Page Layouts

**Admin & Teacher portals — sidebar layout**
```
[Sidebar 220px fixed] [Main content flex-1]
Main content: padding 24px; max-width none; overflow-y auto
```

**Parent portal — mobile-first feed layout**
```
[Top nav 56px] [Content max-width 600px; margin auto; padding 16px]
Optimized for mobile: single-column feed of daily reports and messages
```

**Responsive breakpoints**
```
sm:  640px   — mobile to small tablet
md:  768px   — tablet
lg:  1024px  — desktop (sidebar appears)
xl:  1280px  — wide desktop
```

**Mobile behavior**
- Sidebar collapses to bottom tab bar on mobile (< lg)
- Cards go full-width on mobile
- Tables scroll horizontally on mobile with sticky first column
- Parent portal is mobile-first — the primary device for parents

### Grid
- Content grids: `repeat(auto-fit, minmax(240px, 1fr))` with `gap: 16px`
- KPI stat cards: `repeat(auto-fit, minmax(180px, 1fr))` with `gap: 12px`
- 2-column forms: `grid-template-columns: 1fr 1fr` with `gap: 16px`

---

## 6. Elevation & Shadow System

```
Level 0 — Flat:    no shadow (default surfaces, sidebars)
Level 1 — Raised:  0 1px 3px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)
Level 2 — Float:   0 4px 12px rgba(15,23,42,0.08), 0 2px 4px rgba(15,23,42,0.04)
Level 3 — Overlay: 0 10px 30px rgba(15,23,42,0.12), 0 4px 8px rgba(15,23,42,0.06)
Level 4 — Modal:   0 20px 60px rgba(15,23,42,0.15), 0 8px 16px rgba(15,23,42,0.08)
Focus ring:        0 0 0 3px rgba(79,70,229,0.25)  — indigo focus
Danger focus:      0 0 0 3px rgba(220,38,38,0.20)  — red focus
```

---

## 7. Iconography

- **Library**: Lucide React (consistent line-weight, clean geometric style)
- **Size**: 16px for inline/table, 20px for navigation, 24px for feature icons
- **Stroke width**: 1.5px (Lucide default — do not change)
- **Color**: Inherits from parent text color — never hardcoded
- **Navigation icons** (suggested):
  - Dashboard: `LayoutDashboard`
  - Children: `Baby` or `Users`
  - Classrooms: `DoorOpen`
  - Attendance: `ClipboardCheck`
  - Communication: `MessageCircle`
  - Announcements: `Megaphone`
  - Calendar: `Calendar`
  - Finance: `Receipt`
  - Invoices: `FileText`
  - Settings: `Settings`
  - School: `Building2`
  - Staff: `UserCog`
  - Reports: `BarChart2`

---

## 8. Motion & Transitions

- **Default transition**: `150ms ease` for color, background, border, opacity
- **Layout transitions**: `200ms ease` for width, height changes
- **Modal entrance**: `scale(0.96) → scale(1)`, opacity `0 → 1`, `200ms ease-out`
- **Toast / notification**: slide in from top-right, `300ms ease-out`
- **Page transitions**: fade opacity `0 → 1`, `150ms ease`
- **Reduced motion**: all animations respect `prefers-reduced-motion: reduce`
- **No bounce, spring, or elastic effects** — this is a professional management tool, not a consumer app

---

## 9. Portal-Specific Design Guidelines

### Admin portal — information density
- Use compact table rows (40px height) for lists
- KPI cards in a 4-column grid at the top of the dashboard
- Sidebar is always visible on desktop
- Data tables have sortable columns, pagination, and search
- Use slate-heavy palette — fewer accent colors, more structure

### Teacher portal — task efficiency
- Attendance roll call is a full-screen focused view — no distractions
- Daily report form uses large tap targets (48px minimum) for mobile use
- Chat inbox uses a 2-column layout: conversation list left, active chat right
- Quick-action buttons (mark all present, send report) are prominent

### Parent portal — emotional warmth
- Daily report card is the hero component — large, image-forward
- Mood color strip at the top of each report sets emotional tone immediately
- Child's photo is always visible in the header
- Unread message badge uses indigo `#4F46E5` — warm, not alarming
- Invoice notifications use amber, not red — fees are normal, not scary
- Absent notifications use a soft red banner with reassuring copy

### RTL (Arabic) support
- All flex layouts use `row-reverse` when `dir="rtl"`
- Sidebar moves to the right
- Message bubbles flip alignment
- Icons that convey direction (arrows, chevrons) are mirrored
- Font size for Arabic body text increases by 1px (15px instead of 14px)
- Line height for Arabic increases to 1.8

---

## 10. Design Guardrails

**Always:**
- Use semantic color tokens — never hardcode hex values in components
- Maintain 4.5:1 contrast ratio for all body text (WCAG AA)
- Support both LTR (French) and RTL (Arabic) layouts
- Use Inter Variable for all UI text
- Keep border-radius consistent: 8px for inputs/buttons, 12px for cards, 16px for modals
- Use Lucide React icons at consistent sizes

**Never:**
- Use pure black (`#000000`) or pure white (`#FFFFFF`) for text on backgrounds — always use slate tokens
- Apply decorative gradients, glows, or blur effects on UI surfaces
- Use font weights above 700 or below 400 in UI context
- Place text below 11px
- Mix warm and cool grays — the palette is warm-neutral (slate) throughout
- Use red for anything other than errors, absent status, or destructive actions
- Animate layout shifts or use bounce/spring effects
- Show loading spinners for actions under 300ms — use optimistic UI instead

**Component do-nots:**
- Do not add shadows to sidebar or top nav — borders only
- Do not use colored backgrounds on the main content area — white or off-white only
- Do not use card shadows on flat list items — hover background only
- Do not stack more than 3 levels of visual hierarchy in a single card
