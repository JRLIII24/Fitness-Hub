# Figma AI Design Prompt for Fit-Hub

## 🎯 App Overview

**App Name**: Fit-Hub
**Category**: Fitness tracking & social workout platform
**Platform**: Progressive Web App (mobile-first, responsive)
**Target Audience**: Gym enthusiasts, weightlifters, fitness athletes (18-45 years old)
**Design Philosophy**: Premium dark mode UI with electric accents, smooth animations, and high data density

---

## 🎨 Design System Specifications

### Color Palette (OKLCH-based)

**Base Colors (Dark Mode)**:
- Background: `oklch(12% 0.01 264)` → `#0F0F11` (deep charcoal with blue tint)
- Surface: `oklch(18% 0.01 264)` → `#1C1C20` (elevated cards)
- Surface Elevated: `oklch(22% 0.01 264)` → `#252529` (modals, dialogs)
- Border: `oklch(28% 0.01 264)` → `#35353A` (subtle dividers)

**Text Colors**:
- Primary Text: `oklch(98% 0 0)` → `#FAFAFA` (high contrast white)
- Secondary Text: `oklch(70% 0 0)` → `#B3B3B3` (muted gray)
- Tertiary Text: `oklch(50% 0 0)` → `#808080` (disabled)

**Accent System** (user-customizable, default = Electric Blue):
- Primary Accent: `oklch(70% 0.20 240)` → Electric Blue `#4D9FFF`
- Accent variants available: Neon Pink, Sunset Orange, Lime Green, Gold, Purple

**Semantic Colors**:
- Success: `oklch(72% 0.18 145)` → Emerald `#34D399` (streaks, goals met)
- Warning: `oklch(80% 0.15 85)` → Amber `#FBBF24` (fatigue alerts)
- Error: `oklch(65% 0.22 25)` → Red `#EF4444` (delete, cancel)

**Set Type Colors** (colored borders + translucent backgrounds):
- Warmup: `oklch(85% 0.12 85)` → Yellow `#FCD34D` at 10% opacity + 20% border
- Working: `oklch(70% 0.20 240)` → Blue `#4D9FFF` at 10% opacity + 20% border
- Dropset: `oklch(75% 0.18 40)` → Orange `#FB923C` at 10% opacity + 20% border
- Failure: `oklch(65% 0.22 25)` → Red `#EF4444` at 10% opacity + 20% border

**Macro Colors**:
- Protein: `oklch(70% 0.15 240)` → Blue `#60A5FA`
- Carbs: `oklch(80% 0.14 85)` → Yellow `#FCD34D`
- Fat: `oklch(75% 0.18 340)` → Pink `#F472B6`
- Fiber: `oklch(72% 0.16 145)` → Green `#4ADE80`

**Special Effects**:
- PR Badge Gradient: Linear gradient from `#FCD34D` (yellow) to `#F59E0B` (amber)
- Streak Badge Gradient: Linear gradient from `#FB923C` (orange) to `#EF4444` (red)
- Card Gradient (subtle): `linear-gradient(135deg, oklch(18% 0.01 264), oklch(16% 0.01 264))`

---

### Typography

**Font Family**:
- Primary: Inter Variable (sans-serif)
- Monospace (numbers): JetBrains Mono

**Type Scale** (fluid, mobile-first):
- **XS**: 12-13px (metadata, labels) — `font-size: clamp(0.75rem, 0.7rem + 0.25vw, 0.8rem)`
- **SM**: 14-14.4px (body text) — `font-size: clamp(0.875rem, 0.85rem + 0.15vw, 0.9rem)`
- **Base**: 16-18px (emphasis) — `font-size: clamp(1rem, 0.95rem + 0.25vw, 1.125rem)`
- **LG**: 18-24px (headings) — `font-size: clamp(1.125rem, 1rem + 0.625vw, 1.5rem)`
- **XL**: 24-36px (hero) — `font-size: clamp(1.5rem, 1.25rem + 1.25vw, 2.25rem)`
- **2XL**: 32-56px (dashboard stats) — `font-size: clamp(2rem, 1.5rem + 2.5vw, 3.5rem)`

**Font Weights**:
- Regular: 400 (body)
- Medium: 500 (labels, buttons)
- Semibold: 600 (headings, emphasis)
- Bold: 700 (hero stats, CTAs)

**Line Heights**:
- Tight: 1.2 (large numbers, stats)
- Base: 1.5 (body text)
- Relaxed: 1.75 (long-form)

---

### Spacing & Layout

**Base Grid**: 4px

**Spacing Scale**:
- `1`: 4px (icon padding)
- `2`: 8px (tight gaps)
- `3`: 12px (compact card padding)
- `4`: 16px (standard gap)
- `5`: 20px (section spacing)
- `6`: 24px (card padding)
- `8`: 32px (large sections)
- `12`: 48px (hero spacing)

**Layout Constraints**:
- Mobile (< 640px): Full width with 16px horizontal padding
- Tablet (640px - 1024px): Max-width 768px centered
- Desktop (1024px+): Max-width 1280px centered

**Safe Areas**:
- Bottom nav height: 64px + `env(safe-area-inset-bottom)` for iOS
- Top padding: `env(safe-area-inset-top)` for notched devices

---

### Border Radius

**Radius Scale**:
- `sm`: 6px (chips, badges)
- `md`: 10px (buttons, inputs)
- `lg`: 16px (cards, modals)
- `xl`: 24px (large containers, bottom sheets)
- `full`: 9999px (pills, avatars)

**Default**: Use `lg` (16px) for all cards

---

### Shadows & Elevation

**Card Shadows** (layered depth):
- **Level 1** (default card): `0 1px 3px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.24)`
- **Level 2** (hover card): `0 4px 6px rgba(0, 0, 0, 0.3), 0 2px 4px rgba(0, 0, 0, 0.24)`
- **Level 3** (modal): `0 10px 25px rgba(0, 0, 0, 0.4), 0 4px 10px rgba(0, 0, 0, 0.3)`

**Glow Effects** (for PR badges, active states):
- PR Glow: `0 0 20px rgba(251, 191, 36, 0.4)` (amber glow)
- Accent Glow: `0 0 12px var(--accent-color)` with 50% opacity

---

### Animation Principles

**Easing**:
- Default: `cubic-bezier(0.4, 0, 0.2, 1)` — smooth, material-like
- Expo Out: `cubic-bezier(0.16, 1, 0.3, 1)` — aggressive deceleration (modals)
- Spring: `cubic-bezier(0.34, 1.56, 0.64, 1)` — bouncy, playful (celebrations)

**Duration**:
- Instant: 150ms (micro-interactions)
- Fast: 250ms (transitions)
- Base: 350ms (page nav, modal open)
- Slow: 500ms (celebrations)

**Transitions to Indicate**:
- Hover states: 200ms color/shadow shift
- Button press: Scale down to 98% on active
- Card expand: 300ms height animation with ease-out
- Page transition: Slide + fade (350ms)

---

## 📱 Component Library

### Buttons

**Variants**:
1. **Primary** (accent background, white text):
   - Idle: Accent color fill, 10px radius, 12px vertical padding, 24px horizontal padding
   - Hover: Darken 10%, lift 2px with shadow
   - Active: Scale 98%, remove shadow
   - Disabled: 40% opacity, no pointer

2. **Secondary** (gray background, text color):
   - Idle: `oklch(22% 0.01 264)` fill, text = secondary
   - Hover: `oklch(26% 0.01 264)` fill
   - Active: Scale 98%

3. **Ghost** (transparent, text only):
   - Idle: Transparent, text = muted
   - Hover: `oklch(18% 0.01 264)` fill
   - Active: Scale 98%

4. **Destructive** (red accent):
   - Same as Primary but with Error color

**Icon Buttons**:
- Square: 40×40px minimum (48×48px recommended for touch)
- Icon size: 20×20px (scale down icon, not button)
- Add 8px padding around icon

---

### Cards

**Default Card**:
- Background: `oklch(18% 0.01 264)` with subtle gradient overlay
- Border: 1px solid `oklch(28% 0.01 264)`
- Radius: 16px
- Padding: 24px
- Shadow: Level 1
- Backdrop blur: 4px (optional, for glassmorphism effect)

**Hover State**:
- Border color shifts to accent at 50% opacity
- Lift 4px with Level 2 shadow
- Transition: 300ms ease-out

**Active/Selected State**:
- Border: 2px solid accent (full opacity)
- Background: Add 5% accent color tint

---

### Inputs

**Text Input**:
- Height: 48px (touch-friendly)
- Padding: 12px horizontal
- Background: `oklch(16% 0.01 264)` (darker than surface)
- Border: 1px solid border color
- Radius: 10px
- Text: 16px (base), color = primary text
- Placeholder: color = tertiary text

**Focus State**:
- Border: 2px solid accent
- Glow: `0 0 0 3px accent at 20% opacity` (focus ring)

**Number Inputs** (weight, reps):
- Use `tabular-nums` (monospace numbers for alignment)
- Center-align text
- Font size: 18px semibold

---

### Progress Indicators

**Circular Progress Ring** (macro rings, rest timer):
- Outer diameter: 120px (macro), 40px (timer pill)
- Ring width: 8px (macro), 2px (timer)
- Background ring: `oklch(28% 0.01 264)` (muted)
- Foreground ring: Semantic color (e.g., protein = blue)
- Animation: `stroke-dashoffset` animates from full circle to remaining arc (750ms ease-out-expo)
- Add glow when 100% complete

**Linear Progress Bar**:
- Height: 6px
- Background: `oklch(28% 0.01 264)`
- Foreground: Accent gradient
- Radius: `full` (pill-shaped)
- Overflow clip so bar never exceeds container

---

### Badges & Pills

**Badge** (small label, e.g., "Warmup", "3 sets"):
- Padding: 4px horizontal, 2px vertical
- Radius: 6px
- Font: 10px uppercase semibold, letter-spacing: 1.2px
- Background: Set type color at 20% opacity
- Border: 1px solid set type color at 30% opacity
- Text color: Set type color at full saturation

**Pill Button** (horizontal scrolling selector):
- Padding: 8px horizontal, 6px vertical
- Radius: `full` (9999px)
- Font: 14px medium
- Idle: Transparent background, muted text
- Selected: Accent background, white text
- Hover: `oklch(22% 0.01 264)` background

**Streak Badge** (fire emoji + count):
- Background: Fire gradient (orange → red)
- Padding: 6px horizontal, 4px vertical
- Radius: `full`
- Icon: 🔥 emoji (16px) + count (14px bold, white text)
- Add subtle pulse animation (scale 1 → 1.05 → 1, 2s infinite)

**PR Badge** (trophy + "PR"):
- Background: Gold gradient (yellow → amber)
- Padding: 8px horizontal, 4px vertical
- Radius: `full`
- Icon: Trophy (16px) + "PR" text (12px bold, black text for contrast)
- Glow: Amber shadow `0 0 20px rgba(251, 191, 36, 0.4)`
- Animate: Pulse on first appearance

---

### Lists & Cards

**Workout Exercise Card** (in active workout):
- Background: Card default
- Padding: 16px
- Each set row: 48px height minimum, 12px gap between rows
- Set number badge: 32px circle, bold text, muted background
- Input fields: Weight (lbs) and Reps, 40px height, center-aligned
- Rest timer dropdown: 40px height, aligned right
- Completion checkmark: 32px circle button, accent when checked
- Previous set indicator: Small muted text below inputs showing "Last: 10 reps @ 135 lbs"

**History Workout Card** (on history page):
- Background: Card with hover lift effect
- Padding: 20px
- Header: Date + duration (e.g., "Feb 17 · 1h 23m")
- Body: Exercise list (3 lines max, truncate with "..."), exercise count badge
- Footer: Volume stat (e.g., "24,500 lbs total volume")
- Right arrow icon on hover

---

### Navigation

**Bottom Nav Bar** (mobile):
- Height: 64px + safe area inset
- Background: `oklch(16% 0.01 264)` with subtle top border
- 5 items: Dashboard, Workout, Nutrition, History, Social
- Each item: 48×48px touch target
  - Icon: 24×24px
  - Label: 11px, below icon
  - Active state: Accent color icon + label
  - Inactive state: Muted color
- Indicator: 3px accent bar above active tab (or pill background behind icon)

**Top Header** (optional on some pages):
- Height: 56px + safe area inset
- Background: Transparent (blur backdrop) or same as page background
- Left: Back button (icon only, 40×40px)
- Center: Page title (18px semibold)
- Right: Action button (e.g., Settings gear icon)

---

## 🖼️ Screens to Generate

Generate **mobile-first designs** (375×812px iPhone 15 size) for the following screens. Include hover states, empty states, and populated states.

---

### Screen 1: Dashboard (Home)

**Layout**:
- Top section: Greeting + avatar (top-right)
  - "Good morning, Ralph" (24px bold)
  - Avatar: 48px circle with initials if no photo
- Quick Stats Row (2 columns):
  - **Left**: Current streak badge (🔥 14 days) with fire gradient
  - **Right**: This week volume (e.g., "24.5K lbs total")
- Active Workout CTA (if workout in progress):
  - Card with green pulse indicator, exercise count, elapsed time
  - "Continue Workout" button (accent primary)
- Quick Action Grid (3 columns):
  - Start Workout (dumbbell icon)
  - Log Food (utensils icon)
  - View Templates (list icon)
- Today's Summary Section:
  - **Nutrition**: Macro rings (3 circular progress rings for protein/carbs/fat)
    - Each ring: 80px diameter, centered text with "120g / 150g" format
  - **Recent Workouts**: Last 3 workout cards (compact, date + exercise count)
- Bottom nav: Active on "Dashboard"

**States to Show**:
1. Active workout in progress (green CTA card visible)
2. No active workout (CTA card hidden, show "Start Workout" as primary action)
3. Streak milestone (e.g., 30 days) — show confetti or badge unlock animation frame

---

### Screen 2: Active Workout (Logging)

**Layout**:
- Sticky Top Bar:
  - Elapsed time (top-left, monospace bold, e.g., "1:23:45")
  - Finish button (top-right, accent primary)
  - Session name centered (e.g., "Push Day A")
- Exercise List (vertical scroll):
  - Each exercise: Card container
    - **Header**: Exercise name (16px semibold) + muscle group badge + delete icon
    - **Sets List**: Stacked set rows
      - Set number badge (left)
      - Set type pill button (Warmup/Working/Dropset/Failure, cycles on tap)
      - Weight input (center, 48px height, "lbs" label)
      - Reps input (center-right, 48px height)
      - Rest dropdown (right, "90s rest" default)
      - Checkmark button (far right, 32px, accent when completed)
      - Previous set indicator below (muted text: "Last: 10 × 135")
    - **Footer**: "Add Set" button (ghost style)
  - Between exercises: "Add Exercise" ghost button
- Rest Timer Pills (floating above bottom nav when active):
  - Stacked pills, each showing:
    - Circular progress ring (40px, depleting)
    - Exercise name + "Rest timer" label
    - Countdown (e.g., "1:23" monospace)
    - Tap to expand: ±15s buttons, pause/resume, stop
- Bottom nav: Active on "Workout"

**States to Show**:
1. Mid-workout with 2 exercises, one set completed (checkmark filled)
2. Rest timer active for one exercise (pill visible)
3. PR achieved on a set (gold trophy icon + glow effect in checkmark button)

---

### Screen 3: Nutrition Log (Daily)

**Layout**:
- Top Section:
  - Date selector (center, "Today ▾" with arrows to navigate)
  - Macro summary card:
    - Large calorie number (2XL, e.g., "1,847 / 2,200 kcal")
    - Progress bar (linear, accent color)
    - Macro breakdown row (4 pills):
      - Protein: 120g / 150g (blue)
      - Carbs: 180g / 220g (yellow)
      - Fat: 60g / 70g (pink)
      - Fiber: 25g / 30g (green)
- Meal Sections (vertical scroll):
  - **Breakfast** header (14px semibold, muted) + Add button
    - Food entry cards (each 64px height):
      - Food name (14px medium)
      - Serving size (12px muted, "1.5 servings")
      - Macro row (12px muted, "240 cal · 20g P · 30g C · 8g F")
      - Delete icon (right)
  - Repeat for Lunch, Dinner, Snack
- Floating "Add Food" FAB (bottom-right, 56×56px circle, accent, plus icon)
- Bottom nav: Active on "Nutrition"

**States to Show**:
1. Full day logged (all meals populated)
2. Empty state for a meal section ("No food logged yet")
3. Goal exceeded (calorie bar red, "Over by 247 cal" warning)

---

### Screen 4: Workout History

**Layout**:
- Header: "History" title (24px bold)
- Filter row (horizontal scroll pills):
  - All, This Week, This Month, Last 30 Days
- Workout Cards (vertical scroll):
  - Each card (hover lift effect):
    - **Header**: Date + day (e.g., "Feb 17 · Saturday") + duration badge
    - **Body**: Exercise list (3 max, "+ 2 more" if longer)
    - **Footer**: Volume stat (e.g., "24,500 lbs total") + PR badge if applicable
    - Right arrow icon (muted)
- Empty state: Illustration + "No workouts yet" message
- Bottom nav: Active on "History"

**States to Show**:
1. List of 5 workout cards (varied dates)
2. Empty state for new user
3. Card hover state (lifted with shadow)

---

### Screen 5: Exercise Picker (Modal/Sheet)

**Layout**:
- Top bar:
  - "Add Exercise" title (center)
  - Close X button (left)
- Search bar (sticky below top bar):
  - Magnifying glass icon (left)
  - "Search exercises..." placeholder
  - Clear button (right, when typing)
- Muscle Group Tabs (horizontal scroll pills):
  - All, Chest, Back, Shoulders, Arms, Legs, Core
- Exercise List (vertical scroll):
  - Each exercise card (80px height):
    - Exercise name (16px medium)
    - Muscle group + equipment badges (12px, muted)
    - Optional: Thumbnail image (64×64px, rounded, left)
    - Tap entire card to select
- Bottom: "Recent Exercises" section (collapsible)
- Safe area padding at bottom

**States to Show**:
1. Default view (All tab selected, full list)
2. Search active ("bench" typed, filtered results)
3. Selected state (card highlighted with accent border before adding)

---

### Screen 6: Nutrition Scanner (Barcode)

**Layout**:
- Full-screen camera view
- Top bar (overlay):
  - Back button (left)
  - "Scan Barcode" title (center)
  - Manual entry button (right, "123" icon)
- Center: Scanning reticle (animated pulsing box)
- Bottom overlay:
  - Instruction text: "Position barcode in frame"
  - Flash toggle button (if camera supports)
- On scan success:
  - Modal slides up from bottom:
    - Food name (18px semibold)
    - Brand (14px muted)
    - Macro chips row (same as food log card)
    - Serving size selector (pill buttons: 0.25x, 0.5x, 1x, 1.5x, 2x)
    - Meal selector dropdown (Breakfast, Lunch, Dinner, Snack)
    - "Add to Log" button (accent primary, full width)

**States to Show**:
1. Camera active (scanning)
2. Success modal (food found, ready to add)
3. Error state ("Barcode not found, try manual entry")

---

### Screen 7: Social Feed / Public Profile

**Layout** (pick one or both):

**Option A: Feed View**
- Header: "Social" + search icon (right)
- Tabs: Discover, Following, Pings, Shared, Sets (vertical video feed)
- Feed cards (for Following/Sets tab):
  - User avatar + name (top-left)
  - "Working out now" green badge (if active workout)
  - Content: Workout summary or video clip
  - Footer: Like count + comment count
- Empty state: "Follow users to see their activity"

**Option B: Public Profile View**
- Cover area (optional gradient)
- Avatar (80×80px circle, centered)
- Display name (18px bold) + @username (14px muted)
- Bio (14px, max 2 lines)
- Stats row (3 columns):
  - Streak: 🔥 14 days
  - Workouts: 47 total
  - Following: 12
- Action buttons: Follow (primary) + Ping (ghost)
- Tabs: Templates, Sets (video clips), Calendar (GitHub-style contribution graph)
- Content area: Template cards or clip thumbnails

**States to Show**:
1. Feed with 3 activity cards
2. Profile view with stats + template grid
3. "Working out now" indicator on user card

---

### Screen 8: Settings

**Layout**:
- Header: "Settings" title + close/back button
- Profile Section:
  - Avatar (large, 96×96px)
  - Edit Profile button (ghost)
- Settings List (grouped sections):
  - **Account**:
    - Display Name
    - Username
    - Bio
    - Fitness Goal (dropdown)
  - **Appearance**:
    - Accent Color picker (horizontal scroll of color swatches)
    - Theme (Dark / Light toggle switch)
  - **Units**:
    - Weight (kg / lbs toggle)
    - Height (cm / ft toggle)
  - **Privacy**:
    - Public Profile toggle
  - **Notifications**:
    - Push Notifications toggle
    - Rest Timer Alerts toggle
  - **Actions**:
    - Sign Out button (destructive, red text)
- Each setting row: 56px height, label + value/control

**States to Show**:
1. Default view (all settings)
2. Accent color picker expanded (8 color swatches)
3. Toggle switch in ON state (accent color)

---

## 🎯 Design Guidelines

### Do's:
✅ Use high contrast (text on dark background should be `oklch(98% 0 0)`)
✅ Apply subtle gradients to cards for depth (`135deg` diagonal)
✅ Show data density (fitness apps need lots of info in compact space)
✅ Use tabular numbers (monospace) for stats, weights, reps, times
✅ Include empty states with illustrations or friendly messages
✅ Add micro-interactions (button press = scale 98%, card hover = lift)
✅ Show loading states (skeleton screens with shimmer)
✅ Indicate touch targets clearly (48×48px minimum)
✅ Use accent color sparingly (buttons, active states, progress)
✅ Add glow effects for special moments (PRs, streaks, celebrations)

### Don'ts:
❌ Don't use pure black (`#000000`) — use `oklch(12% 0.01 264)` instead
❌ Don't mix color spaces (stick to OKLCH for consistency)
❌ Don't make buttons smaller than 44×44px (WCAG touch target)
❌ Don't use light mode colors (this is dark mode only for now)
❌ Don't add decorative elements that don't serve the user (no random shapes)
❌ Don't use low contrast text (`oklch(50% 0 0)` on `oklch(12% 0.01 264)` fails WCAG)
❌ Don't overcrowd the UI (use whitespace generously, 16-24px gaps)
❌ Don't use more than 3 font weights on one screen

---

## 🚀 AI Generation Tips

**For Best Results**:
1. Start with **one screen at a time** (e.g., "Generate Dashboard screen only")
2. Use this exact color palette (paste hex codes into Figma color picker)
3. Request **multiple states** (empty, populated, hover, active)
4. Ask for **components first**, then compose screens
5. Specify **device frame** (iPhone 15 Pro, 375×812px)
6. Request **annotations** (spacing, font sizes, color names)

**Example AI Prompts**:

```
"Generate a mobile fitness app dashboard screen (375×812px) with dark mode design.
Background color: #0F0F11. Include: greeting text, streak badge with fire gradient
(orange to red), macro rings (3 circular progress indicators for protein/carbs/fat
in blue/yellow/pink), and a 'Start Workout' button with electric blue accent (#4D9FFF).
Use Inter font, 24px heading, 16px body text. Add subtle card shadows and 16px border radius."
```

```
"Design a workout logging interface for mobile (dark mode). Show an exercise card with:
exercise name header, 3 set rows (each with set number, weight input, reps input,
checkmark button). Use tabular numbers for inputs. One set should be completed (checkmark
filled with accent color). Include a rest timer pill at bottom with circular progress ring.
Colors: background #1C1C20, accent #4D9FFF, text #FAFAFA."
```

```
"Create a circular macro progress ring component. Outer diameter 120px, ring width 8px.
Background ring: #35353A (muted gray). Foreground ring: blue gradient (#60A5FA).
Center text: '120g / 150g' in white, 'Protein' label below in gray. Show ring at 80% full.
Dark background #0F0F11."
```

---

## 📤 Export Settings

When exporting from Figma:
- Format: PNG (2x for retina) or SVG (for icons)
- Background: Transparent for components, dark for full screens
- Include: Device frame (optional) for presentation
- Organize: Artboards by feature (Dashboard, Workout, Nutrition, etc.)

---

## ✅ Checklist Before Generating

- [ ] Color palette matches OKLCH codes above
- [ ] All text is high contrast (WCAG AAA where possible)
- [ ] Touch targets are 48×48px minimum
- [ ] Buttons have hover/active states defined
- [ ] Cards have subtle shadows for depth
- [ ] Spacing uses 4px grid (8px, 12px, 16px, 24px gaps)
- [ ] Typography uses Inter Variable at specified sizes
- [ ] Icons are 20-24px for UI, 16px for inline
- [ ] Safe area insets are shown (iOS notch, home indicator)
- [ ] Bottom nav is 64px + safe area padding

---

**Ready to generate!** Copy sections of this prompt into your AI tool and iterate on specific screens or components.
