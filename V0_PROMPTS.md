# v0.dev Prompts for Fit-Hub

Complete collection of v0.dev prompts for every screen and component in Fit-Hub. Copy-paste these directly into https://v0.dev to generate React + Tailwind code.

---

## 📱 Core Screens

### 1. Dashboard (Home)

```
Create a mobile fitness app dashboard with dark mode design (375px width).

COLORS:
- Background: #0F0F11 (deep charcoal)
- Card background: #1C1C20
- Border: #35353A
- Text primary: #FAFAFA
- Text muted: #B3B3B3
- Accent: #4D9FFF (electric blue)
- Success green: #34D399

LAYOUT (vertical stack with 16px gaps):

1. HEADER (padding 20px):
   - "Good morning, Ralph" (24px bold, white)
   - Avatar: 48px circle, top-right, initials "RL" on gray background

2. STREAK CARD (full width):
   - Fire emoji 🔥 + "14 day streak" text
   - Background: linear-gradient(to right, #FB923C, #EF4444)
   - Padding: 12px, rounded 12px, white text

3. QUICK STATS (2 columns, equal width):
   - Left: "This Week" label + "24.5K lbs" (large bold number)
   - Right: "Workouts" label + "5" (large bold number)
   - Card style: #1C1C20 background, rounded 16px, padding 16px

4. CONTINUE WORKOUT CARD (if active):
   - Green dot (8px, #34D399) + "Workout in progress"
   - "Push Day A • 45 min elapsed"
   - "Continue Workout" button (full width, accent blue, 48px height)

5. QUICK ACTIONS (3 columns):
   - Start Workout (dumbbell icon)
   - Log Food (utensils icon)
   - Templates (list icon)
   - Each: 80px x 80px card, icon centered, label below

6. MACRO RINGS SECTION:
   - Title: "Today's Nutrition" (16px semibold)
   - 3 circular progress rings (100px diameter, horizontal layout):
     * Protein: 120g/150g (blue #60A5FA, 80% filled)
     * Carbs: 180g/220g (yellow #FCD34D, 82% filled)
     * Fat: 60g/70g (pink #F472B6, 86% filled)
   - Ring style: 6px stroke, background ring #35353A, colored foreground
   - Center text: "120g" (14px bold), "/ 150g" (12px muted) stacked vertically

7. RECENT WORKOUTS:
   - Title: "Recent Workouts" (16px semibold)
   - 2 workout cards (stack vertically):
     * Date: "Feb 17 • Saturday" (14px muted)
     * Duration: "1h 23m" badge (12px, #35353A background)
     * Exercises: "Bench Press, Incline DB Press, +3 more" (14px)
     * Volume: "24,500 lbs" (12px muted)
     * Right arrow icon

Use Inter font, all cards have 16px border radius, 1px border #35353A, subtle shadow.
Bottom padding: 80px (for bottom nav space).
```

---

### 2. Active Workout Page

```
Design a workout logging interface for mobile fitness app (375px width, dark mode).

COLORS:
- Background: #0F0F11
- Card: #1C1C20
- Border: #35353A
- Text: #FAFAFA (primary), #B3B3B3 (muted)
- Accent: #4D9FFF
- Success: #34D399
- Warning: #FCD34D (yellow)
- Destructive: #EF4444

STICKY TOP BAR (56px height, fixed):
- Left: Elapsed time "1:23:45" (monospace, 18px bold)
- Center: "Push Day A" (16px semibold)
- Right: "Finish" button (accent blue, rounded pill)

EXERCISE CARDS (vertical scroll, 16px gap):

CARD 1 - Bench Press (active):
- Header:
  * Exercise name "Bench Press" (16px semibold)
  * Muscle group badge "Chest" (12px, #35353A background, rounded pill)
  * Delete icon (right, gray)
- Set rows (3 sets, 48px height each, 8px gap):

  SET 1 (completed):
  * Set number: Circle badge "1" (32px diameter, #35353A)
  * Set type: "WARMUP" pill (yellow #FCD34D at 20% opacity, yellow border)
  * Weight: Input "135" + "lbs" label (40px height, center-aligned, tabular-nums)
  * Reps: Input "10" (40px height, center-aligned)
  * Rest: Dropdown "90s" (40px height)
  * Checkmark: Filled circle (accent blue, 32px, checkmark icon white)
  * Below: "Last: 10 × 135" (11px, muted)

  SET 2 (in progress, PR achieved):
  * Set number: "2"
  * Set type: "WORKING" pill (blue #4D9FFF at 20% opacity)
  * Weight: Input "185"
  * Reps: Input "8"
  * Rest: "90s"
  * Checkmark: GOLD GRADIENT circle (linear-gradient from #FCD34D to #F59E0B)
  * Trophy icon inside checkmark (gold)
  * Gold glow: box-shadow 0 0 20px rgba(251, 191, 36, 0.4)
  * Below: "Last: 6 × 180 | Today: 8 × 185" with "PR" badge (gold, rounded pill)

  SET 3 (empty):
  * Set number: "3"
  * Set type: "WORKING" pill
  * Weight: Empty input with placeholder "0"
  * Reps: Empty input
  * Rest: "90s"
  * Checkmark: Empty circle (border only, gray)

- Footer: "+ Add Set" button (ghost style, full width)

CARD 2 - Incline DB Press (collapsed):
- Header only showing name + "3 sets" badge
- Tap to expand

FLOATING REST TIMER PILL (above bottom of screen):
- Compact pill (rounded-2xl, #1C1C20 with backdrop-blur):
  * Left: Circular progress ring (40px, depleting, blue stroke)
  * Center: "Bench Press" (14px) + "Rest timer" (12px muted) stacked
  * Inside ring: "1:23" countdown (12px bold, monospace)
  * Right: Status dot (6px, blue if running, gray if paused)
- Tap to expand:
  * Shows ±15s buttons (small, ghost)
  * Pause/Resume button (blue)
  * Stop button (red)

Bottom space: 80px padding for nav.

Use tabular-nums for all numbers. Inter font. All inputs have dark background #16161A, 10px rounded corners.
```

---

### 3. Nutrition Daily Log

```
Create a nutrition tracking interface (mobile, 375px, dark mode).

COLORS:
- Background: #0F0F11
- Card: #1C1C20
- Text: #FAFAFA, #B3B3B3
- Accent: #4D9FFF
- Protein: #60A5FA (blue)
- Carbs: #FCD34D (yellow)
- Fat: #F472B6 (pink)
- Fiber: #4ADE80 (green)

TOP SECTION:

1. DATE SELECTOR (56px height, sticky):
   - Left arrow button
   - Center: "Today ▾" (tap to open calendar)
   - Right arrow button
   - Background: #1C1C20, bottom border #35353A

2. MACRO SUMMARY CARD:
   - Large calorie display:
     * "1,847" (36px bold) + "/ 2,200" (18px muted) + "kcal" (14px)
     * "353 remaining" below (14px, muted)
   - Progress bar (full width, 6px height, rounded-full):
     * Background: #35353A
     * Fill: Linear gradient accent blue
     * 84% filled
   - Macro breakdown (4 pills, horizontal scroll):
     * Protein: "120g / 150g" (blue background 10% opacity, blue text, rounded-full)
     * Carbs: "180g / 220g" (yellow bg, yellow text)
     * Fat: "60g / 70g" (pink bg, pink text)
     * Fiber: "25g / 30g" (green bg, green text)
     * Each pill: 12px height, 6px padding horizontal

MEAL SECTIONS (vertical scroll):

BREAKFAST (expanded):
- Header: "Breakfast" (14px semibold, muted) + "Add" button (right, accent)
- Food entries (2 items):

  ENTRY 1:
  - Name: "Oatmeal with Banana" (14px medium, white)
  - Serving: "1.5 servings" (12px muted)
  - Macros: "340 cal • 12g P • 58g C • 8g F" (12px muted, with colored dots)
  - Delete icon (right, ghost button)
  - Card: 64px height, #1C1C20, rounded 12px, 12px padding

  ENTRY 2:
  - Name: "Protein Shake"
  - Serving: "1 scoop"
  - Macros: "120 cal • 24g P • 2g C • 1g F"
  - Delete icon

- Section total: "460 cal" (12px muted, right-aligned below entries)

LUNCH (collapsed):
- Header: "Lunch" + item count "(3 items)" + total "780 cal"
- Tap to expand

DINNER (empty):
- Header: "Dinner" + "Add" button
- Empty state: "No food logged" (centered, muted, with fork/knife icon)

SNACK (collapsed):
- Similar to Lunch

FLOATING ACTION BUTTON:
- Bottom-right corner, 56px circle
- Accent blue background
- Plus icon (white, 24px)
- Shadow: 0 4px 12px rgba(77, 159, 255, 0.3)
- Position: 16px from right, 80px from bottom (above nav)

Colored dots for macros: 6px circles matching macro colors before each value.
Use Inter font, tabular-nums for numbers.
```

---

### 4. Workout History

```
Design a workout history page (mobile, dark mode, 375px).

COLORS:
- Background: #0F0F11
- Card: #1C1C20
- Border: #35353A
- Text: #FAFAFA, #B3B3B3
- Accent: #4D9FFF
- Gold: #FCD34D (for PR badges)

HEADER (fixed, 56px):
- Title: "History" (24px bold)
- Filter icon (right)

FILTER PILLS (horizontal scroll, sticky below header):
- Pills: "All", "This Week", "This Month", "Last 30 Days"
- Active pill: Accent blue background, white text
- Inactive: Transparent, muted text
- Pill style: Rounded-full, 8px padding horizontal, 6px vertical

WORKOUT CARDS (vertical scroll, 12px gap):

CARD 1 (most recent, has PR):
- Header row:
  * Date: "Feb 17 • Saturday" (14px semibold)
  * Duration badge: "1h 23m" (12px, #35353A background, rounded-full)
  * PR badge: "PR" (12px, gold gradient background, black text, trophy icon)
- Exercise list (3 lines max):
  * "Bench Press" (14px, white)
  * "Incline DB Press" (14px, white)
  * "Cable Flyes" (14px, white)
  * "+ 2 more exercises" (14px, muted) if truncated
- Footer:
  * Volume: "24,500 lbs total volume" (12px, muted)
  * Right arrow icon (muted)
- Card style: #1C1C20, rounded-xl (16px), padding 16px
- Hover state: Lift 4px with shadow, border accent blue 50% opacity

CARD 2 (Feb 16):
- Same structure, no PR badge
- Different exercises

CARD 3 (Feb 14):
- Same structure

EMPTY STATE (if no workouts):
- Centered in viewport
- Dumbbell icon (48px, muted)
- "No workouts yet" (18px semibold, muted)
- "Start your first workout to see it here" (14px, muted)
- "Start Workout" button (accent, rounded-lg)

Bottom padding: 80px for nav.

Transition: All cards animate on hover (transform: translateY(-4px), 200ms ease-out).
Shadow on hover: 0 8px 16px rgba(0, 0, 0, 0.4).
```

---

### 5. Exercise Picker Modal

```
Create an exercise picker modal (mobile sheet, dark mode, 375px width, 80vh height).

COLORS:
- Background: #0F0F11
- Sheet background: #1C1C20
- Border: #35353A
- Text: #FAFAFA, #B3B3B3
- Accent: #4D9FFF

MODAL STRUCTURE (bottom sheet):
- Handle bar: 32px wide, 4px height, #35353A, rounded-full, centered at top
- Border radius: 24px top corners only

TOP BAR (sticky, 56px):
- Left: Close "X" button (40px, ghost)
- Center: "Add Exercise" (18px semibold)
- Right: Recent icon (40px, ghost)
- Bottom border: 1px #35353A

SEARCH BAR (sticky below top bar):
- Magnifying glass icon (left, 20px, muted)
- Input: "Search exercises..." placeholder (16px)
- Clear "×" button (right, when typing)
- Background: #16161A (darker than sheet)
- Height: 48px, rounded-lg, 12px padding

MUSCLE GROUP TABS (horizontal scroll, sticky):
- Pills: "All", "Chest", "Back", "Shoulders", "Arms", "Legs", "Core"
- Active: Accent blue background, white text
- Inactive: Transparent, muted text
- Pill style: Rounded-full, 12px padding horizontal, 6px vertical, 8px gap between

EXERCISE LIST (scroll, 12px gap):

EXERCISE CARD 1:
- Left: Exercise image (64px square, rounded-lg, object-cover)
- Middle (flex-1):
  * Name: "Barbell Bench Press" (16px medium, white)
  * Badges row:
    - Muscle: "Chest" (11px, #35353A background, rounded-md)
    - Equipment: "Barbell" (11px, #35353A background)
- Right: Chevron icon (muted)
- Card: 80px height, #1C1C20 when idle
- Hover/Select: Border accent blue 2px, background accent 5% opacity
- Tap entire card to select

EXERCISE CARD 2 (selected state):
- Same structure
- Border: 2px solid accent blue
- Background: Accent blue 5% opacity
- Checkmark icon (top-right, 20px, accent blue)

EXERCISE CARD 3:
- Same as Card 1

RECENT EXERCISES SECTION (collapsible):
- Header: "Recent Exercises" (14px semibold, muted) + collapse icon
- 3 compact cards (same structure as above)
- Separator line above section

BOTTOM BUTTON (sticky):
- "Add Exercise" button (full width, accent blue, 48px height)
- Disabled when no selection (40% opacity)
- Safe area padding: 16px from bottom + env(safe-area-inset-bottom)

Sheet animation: Slide up from bottom (350ms cubic-bezier(0.4, 0, 0.2, 1)).
Backdrop: Black 60% opacity.
```

---

### 6. Food Barcode Scanner

```
Design a barcode scanner interface (full-screen mobile, dark mode).

COLORS:
- Background: Black (for camera feed)
- Overlay: rgba(15, 15, 17, 0.8)
- Accent: #4D9FFF
- Success: #34D399
- Text: #FAFAFA

CAMERA VIEW (full-screen):
- Live camera feed (full viewport)
- Dark overlay at top and bottom (gradient from black 80% to transparent)

TOP BAR (absolute, top safe area):
- Left: Back button (40px, white icon, semi-transparent black background circle)
- Center: "Scan Barcode" (16px semibold, white, text-shadow for readability)
- Right: "123" manual entry button (40px, same style as back)

SCANNING RETICLE (centered):
- Rectangle: 280px wide × 160px height
- Border: 4px accent blue, rounded-lg (12px)
- Corners: Extended corner brackets (24px length, 4px thick, accent blue)
- Animated: Pulsing opacity (1.0 → 0.6 → 1.0, 2s infinite)
- Scanning line: Horizontal line inside reticle, animated top to bottom (1.5s infinite)

INSTRUCTION TEXT (below reticle, 24px gap):
- "Position barcode in frame" (14px, white, semi-bold)
- Background: rgba(15, 15, 17, 0.7), rounded-full, 8px padding horizontal

FLASH TOGGLE (bottom-center, above instruction):
- Circle button (48px)
- Flash icon (bolt, 24px, white)
- Background: rgba(255, 255, 255, 0.2)
- Active state: Background yellow 30% opacity

SUCCESS MODAL (slides up after scan):
- Sheet from bottom (rounded-2xl top corners)
- Background: #1C1C20
- Height: auto (max 60vh)

MODAL CONTENT:
- Handle bar (top, centered, 32px × 4px, #35353A)
- Food image (80px square, rounded-lg, centered, margin-top 16px)
- Food name: "Nature Valley Protein Bar" (18px semibold, centered)
- Brand: "Nature Valley" (14px, muted, centered)
- Macro pills (horizontal, centered, 8px gap):
  * "190 cal" (12px, white, #35353A background)
  * "10g P" (blue background 20% opacity, blue text)
  * "24g C" (yellow)
  * "6g F" (pink)
- Serving size selector:
  * Label: "Serving Size" (14px semibold)
  * Pills: "0.25x", "0.5x", "1x" (selected), "1.5x", "2x"
  * Selected: Accent blue background, white text
  * Inactive: #35353A background, muted text
- Meal selector:
  * Label: "Add to" (14px semibold)
  * Dropdown: "Breakfast" (full width, 48px, #16161A background)
  * Dropdown icon (chevron down)
- "Add to Log" button:
  * Full width, accent blue, 48px height
  * Rounded-lg, 16px margin horizontal
  * Bottom padding: 16px + safe area

ERROR STATE:
- Same modal structure
- Red "X" icon (48px, top)
- "Barcode not found" (18px semibold)
- "Try manual entry or scan again" (14px muted)
- "Manual Entry" button (accent)
- "Try Again" button (ghost)

Camera permissions denied:
- Centered content on black background
- Lock icon (48px, muted)
- "Camera access required" (18px semibold)
- "Enable in Settings" button (accent)
```

---

### 7. Social Feed & Profile

```
Create a social fitness feed page (mobile, dark mode, 375px).

COLORS:
- Background: #0F0F11
- Card: #1C1C20
- Border: #35353A
- Text: #FAFAFA, #B3B3B3
- Accent: #4D9FFF
- Online green: #34D399
- Fire gradient: linear-gradient(to right, #FB923C, #EF4444)

HEADER (56px, fixed):
- Title: "Social" (24px bold)
- Right: Search icon (24px, ghost button)

TABS (horizontal scroll, sticky):
- Tabs: "Discover", "Following", "Pings", "Shared", "Sets"
- Active: Accent blue bottom border (3px), white text
- Inactive: Muted text, no border
- Tab style: 14px semibold, 12px padding, 40px min-width

FEED (Following tab active):

ACTIVITY CARD 1:
- Header:
  * Avatar: 40px circle, "JD" initials on gradient
  * Name: "John Doe" (14px semibold)
  * Online dot: 8px circle, green, absolute top-right of avatar
  * "Working out now 💪" badge (12px, green 10% bg, green text, rounded-full)
  * Time: "23 min ago" (12px muted, right)
- Content:
  * Activity: "Completed Push Day A" (14px)
  * Stats: "1h 15m • 24,500 lbs volume" (12px muted)
  * Exercise preview: "5 exercises: Bench Press, Incline DB..." (12px muted, truncated)
- Footer:
  * Like button: Heart icon + "12" count (muted)
  * Comment button: Chat icon + "3" count (muted)
- Card: #1C1C20, rounded-xl, padding 16px, 12px gap

ACTIVITY CARD 2:
- Header: Same structure, no "working out now" badge, offline dot (gray)
- Content: "Hit a new PR on Deadlift 🏆" with gold PR badge
- Footer: Same

USER PROFILE VIEW (alternative layout):
- Cover gradient: Linear gradient blue to transparent (120px height)
- Avatar: 96px circle, centered, border 4px white, margin-top -48px
- Name: "John Doe" (20px bold, centered)
- Username: "@johndoe" (14px muted, centered)
- Bio: "Strength training enthusiast. Chasing PRs." (14px, centered, max 2 lines)
- Stats row (3 columns, centered):
  * Streak: 🔥 "14 days" (fire gradient background, rounded-lg)
  * Workouts: "47 total" (#35353A background)
  * Following: "12" (#35353A background)
  * Each stat: 12px label, 18px bold number
- Action buttons (centered, horizontal):
  * "Follow" (accent blue, rounded-lg, 120px wide)
  * "Ping" (ghost, rounded-lg, 80px wide)
- Tabs: "Templates", "Sets", "Calendar"
- Content area: Template cards grid (2 columns) or video clips

TEMPLATE CARD (in profile):
- Name: "Push Day A" (14px semibold)
- Exercise count: "6 exercises" (12px muted)
- Save count: "84 athletes" (12px muted, with users icon)
- Favorite heart icon (top-right, filled if saved)
- Card: #1C1C20, rounded-lg, padding 12px, aspect-ratio 1:1

Bottom nav: "Social" tab active.
```

---

### 8. Rest Timer Pill Component

```
Create a rest timer pill component (React, mobile, dark mode).

COLORS:
- Background: rgba(28, 28, 32, 0.95) (card with 95% opacity)
- Border: #35353A
- Text: #FAFAFA
- Accent: #4D9FFF
- Muted: #B3B3B3

COMPACT STATE (default, collapsed):
- Container: Rounded-2xl (24px), padding 8px
- Border: 1px #35353A
- Shadow: 0 4px 12px rgba(0, 0, 0, 0.3)
- Backdrop filter: blur(4px)
- Layout: Horizontal flex, gap 8px, align-center

LEFT - Circular Progress Ring:
- Diameter: 40px
- Background ring: #35353A, 2px stroke
- Foreground ring: Accent blue, 2px stroke
- Progress: Animate strokeDashoffset (depleting circle)
- Rotation: -90deg (start from top)
- Center text: "1:23" countdown (12px bold, monospace, white)

MIDDLE - Exercise Info:
- Flex-1 (takes remaining space)
- Exercise name: "Bench Press" (14px medium, truncate)
- Label: "Rest timer" (12px, muted)

RIGHT - Status Dot:
- 6px circle
- Running: Accent blue with pulse animation
- Paused: Gray #B3B3B3
- Absolute right, center-aligned

Tap entire pill to expand.

EXPANDED STATE:
- Same container, padding 12px
- Border-top: 1px #35353A between compact and controls
- Controls row (below main content):

LEFT CONTROLS:
- "-15s" button: Ghost, 28px × 28px, minus icon (12px)
- "+15s" button: Ghost, 28px × 28px, plus icon (12px)
- Gap: 4px

RIGHT CONTROLS:
- Pause/Resume button: Secondary variant, 28px × 28px
  * Running: Pause icon (12px, 2 vertical bars)
  * Paused: Play icon (12px, triangle)
- Stop button: Ghost, 28px × 28px, X icon (12px, red text)
- Gap: 4px

MULTIPLE TIMERS (stacked):
- Container: Flex column, gap 8px
- Each timer: Individual pill as above
- Max 3 visible, scroll if more

NOTIFICATION PERMISSION BANNER (if denied):
- Background: rgba(53, 53, 58, 0.5)
- Border: 1px #35353A, rounded-lg
- Padding: 12px horizontal, 8px vertical
- Icon: Bell-off (12px, muted)
- Text: "Notifications blocked. Enable in browser settings." (11px, muted)
- Full width, above timer pills

ANIMATIONS:
- Expand/collapse: Height 200ms cubic-bezier(0.4, 0, 0.2, 1)
- Progress ring: Smooth strokeDashoffset transition 100ms linear
- Pulse (running dot): Scale 1 → 1.2 → 1, 1.5s infinite

Position: Fixed, bottom 80px (above nav), left/right 16px, z-index 40.
```

---

### 9. Settings Page

```
Design a settings page (mobile, dark mode, 375px).

COLORS:
- Background: #0F0F11
- Card: #1C1C20
- Border: #35353A
- Text: #FAFAFA, #B3B3B3
- Accent: #4D9FFF
- Destructive: #EF4444

HEADER (56px, fixed):
- Left: Back button (arrow-left icon, ghost)
- Center: "Settings" (18px semibold)

PROFILE SECTION:
- Avatar: 96px circle, centered
- Edit button: Overlay on avatar (camera icon, bottom-right, 32px circle, accent background)
- Name: "Ralph Luis" (20px bold, centered, margin-top 12px)
- Username: "@ralphyluis" (14px muted, centered)

SETTINGS GROUPS (vertical scroll):

GROUP 1 - ACCOUNT:
- Header: "ACCOUNT" (11px, semibold, uppercase, muted, letter-spacing 1.2px)
- Settings rows:

  ROW 1 - Display Name:
  - Label: "Display Name" (14px, white)
  - Value: "Ralph Luis" (14px, muted, right-aligned)
  - Chevron right icon
  - Height: 56px, border-bottom #35353A
  - Tap to edit (opens modal with input)

  ROW 2 - Username:
  - Label: "Username"
  - Value: "@ralphyluis"
  - Chevron right

  ROW 3 - Bio:
  - Label: "Bio"
  - Value: "Strength training enthusiast..." (truncate)
  - Chevron right

  ROW 4 - Fitness Goal:
  - Label: "Fitness Goal"
  - Value: "Build Muscle" (with trophy icon)
  - Chevron right

GROUP 2 - APPEARANCE:
- Header: "APPEARANCE"

  ROW 1 - Accent Color:
  - Label: "Accent Color"
  - Value: Color swatch row (horizontal scroll):
    * 8 color circles (32px each, 8px gap)
    * Colors: Electric Blue (selected), Neon Pink, Sunset Orange, Lime Green, Gold, Purple, Cyan, Red
    * Selected: 3px white border, slight scale (1.1)
    * Inactive: 2px #35353A border
  - Full row (no chevron)

  ROW 2 - Theme:
  - Label: "Theme"
  - Value: Toggle switch (right)
    * Options: "Dark" (active) / "Light"
    * Switch: Accent blue when active, #35353A when inactive
    * Width: 48px, height: 28px, rounded-full
    * Knob: 24px circle, white, smooth slide transition

GROUP 3 - UNITS:
- Header: "UNITS"

  ROW 1 - Weight:
  - Label: "Weight"
  - Value: Segmented control (right):
    * Options: "kg" / "lbs" (lbs selected)
    * Accent background on selected, muted text on inactive
    * 80px wide, 32px height, rounded-lg

  ROW 2 - Height:
  - Label: "Height"
  - Value: Segmented control "cm" / "ft" (ft selected)

GROUP 4 - PRIVACY:
- Header: "PRIVACY"

  ROW 1 - Public Profile:
  - Label: "Public Profile"
  - Subtitle: "Allow others to view your profile" (12px muted, below label)
  - Value: Toggle switch (ON, accent blue)

GROUP 5 - NOTIFICATIONS:
- Header: "NOTIFICATIONS"

  ROW 1 - Push Notifications:
  - Label: "Push Notifications"
  - Value: Toggle switch (ON)

  ROW 2 - Rest Timer Alerts:
  - Label: "Rest Timer Alerts"
  - Subtitle: "Vibration and sound when timer ends"
  - Value: Toggle switch (ON)

GROUP 6 - ACTIONS:
- Header: "ACTIONS"

  ROW 1 - Sign Out:
  - Label: "Sign Out" (destructive red text, 14px semibold)
  - Icon: Arrow-right-from-bracket (red)
  - No border-bottom
  - Center-aligned

Bottom padding: 32px + safe area.

Transitions: All toggles 200ms ease, color swatches 150ms scale.
```

---

### 10. Template Card Component

```
Create a workout template card component (React, dark mode).

COLORS:
- Card: #1C1C20
- Border: #35353A
- Text: #FAFAFA, #B3B3B3
- Accent: #4D9FFF
- Gradient: linear-gradient(135deg, #1C1C20, #16161A)

CARD STRUCTURE:
- Width: Full (mobile) or 180px (grid)
- Aspect ratio: 4:3 (or auto height on mobile)
- Border: 1px #35353A
- Border radius: 16px
- Background: Gradient (#1C1C20 to #16161A at 135deg)
- Padding: 16px
- Shadow: 0 2px 8px rgba(0, 0, 0, 0.2)

HEADER:
- Template name: "Push Day A" (16px semibold, white, truncate)
- Favorite icon: Heart (top-right, absolute)
  * Filled: Accent blue if favorited
  * Outline: #35353A border if not
  * Size: 20px, tap to toggle

BODY:
- Exercise count: "6 exercises" (14px, muted)
- Exercise preview (3 max, truncate):
  * "Bench Press" (13px, white)
  * "Incline DB Press" (13px, white)
  * "Cable Flyes" (13px, white)
  * "+ 3 more" if truncated (13px, muted)
- Gap between lines: 4px

FOOTER:
- Stats row (flex, justify-between):
  * Left: Target volume "~25K lbs" (12px, muted)
  * Right: Save count "84 athletes" (12px, muted, users icon)
- Separator: 1px #35353A border-top, margin 12px vertical

ACTION BUTTONS (horizontal, gap 8px):
- "Copy" button:
  * Ghost variant, full flex-1
  * Icon: Copy (16px)
  * Text: "Copy" (13px)
  * Height: 36px
- "View" button:
  * Secondary variant, flex-1
  * Icon: Arrow-right (16px)
  * Text: "View" (13px)
  * Height: 36px

STATES:
- Hover: Border accent blue 50% opacity, lift 2px, shadow increase
- Active: Scale 98%
- Shared badge: If template.is_shared, show "Public" badge (top-left, 10px text, accent 20% bg, rounded-md)

VARIANTS:

OWN TEMPLATE (can edit):
- Add "Edit" button (ghost, pencil icon)
- Add "Delete" option (destructive, trash icon)
- Share toggle visible

PUBLIC TEMPLATE (from others):
- Show creator: "@username" (11px, muted, top below name)
- "Copy" button prominent (accent primary)
- No edit/delete options

Transition: All 200ms ease-out.
```

---

### 11. Macro Ring Component

```
Create a circular macro progress ring component (React, dark mode).

COLORS:
- Background ring: #35353A (muted gray)
- Protein ring: #60A5FA (blue)
- Carbs ring: #FCD34D (yellow)
- Fat ring: #F472B6 (pink)
- Text: #FAFAFA (primary), #B3B3B3 (muted)

COMPONENT PROPS:
- macroType: "protein" | "carbs" | "fat" | "fiber"
- current: number (e.g., 120)
- target: number (e.g., 150)
- size: "sm" (80px) | "md" (100px) | "lg" (120px)

STRUCTURE (size: lg, 120px):

SVG CONTAINER:
- Width: 120px, height: 120px
- ViewBox: "0 0 120 120"
- Transform: rotate(-90deg) to start from top

BACKGROUND CIRCLE:
- Center: cx="60", cy="60"
- Radius: 52px (leaves 16px for stroke width + padding)
- Stroke: #35353A
- Stroke-width: 8px
- Fill: none

FOREGROUND CIRCLE (progress):
- Center: cx="60", cy="60"
- Radius: 52px (same as background)
- Stroke: Color based on macroType (blue for protein)
- Stroke-width: 8px
- Fill: none
- Stroke-linecap: round
- Stroke-dasharray: Calculate circumference (2 × π × 52 = ~327)
- Stroke-dashoffset: Calculate based on progress percentage
  * Formula: circumference × (1 - progress / 100)
  * Example: 80% filled = 327 × 0.2 = 65.4 offset
- Transition: stroke-dashoffset 750ms cubic-bezier(0.16, 1, 0.3, 1)

CENTER TEXT (absolute positioned):
- Container: Absolute, centered in SVG
- Display: Flex column, align-center
- Current value: "120g" (18px bold, white, tabular-nums)
- Separator: "/" (14px, muted)
- Target value: "150g" (14px, muted, tabular-nums)
- Label: "Protein" (11px, muted, margin-top 2px)

GLOW EFFECT (when 100% complete):
- Filter: drop-shadow(0 0 12px macroColor at 60% opacity)
- Animation: Pulse (opacity 0.6 → 1 → 0.6, 2s infinite)

VARIANTS:

SMALL (80px):
- Radius: 34px
- Stroke-width: 6px
- Current: 14px bold
- Target: 11px muted
- No label

MEDIUM (100px):
- Radius: 44px
- Stroke-width: 7px
- Current: 16px bold
- Target: 12px muted
- Label: 10px

LARGE (120px):
- As specified above

COLOR MAPPING:
- protein: #60A5FA (blue)
- carbs: #FCD34D (yellow)
- fat: #F472B6 (pink)
- fiber: #4ADE80 (green)

Use Inter font, enable tabular-nums for number alignment.
```

---

### 12. Set Row Component

```
Create a workout set logging row component (React, dark mode).

COLORS:
- Background: Transparent (parent card provides bg)
- Input bg: #16161A (darker than card)
- Border: #35353A
- Text: #FAFAFA
- Muted: #B3B3B3
- Accent: #4D9FFF
- Set types:
  * Warmup: #FCD34D (yellow) at 20% bg, 30% border
  * Working: #4D9FFF (blue) at 20% bg, 30% border
  * Dropset: #FB923C (orange) at 20% bg, 30% border
  * Failure: #EF4444 (red) at 20% bg, 30% border
- PR gold: linear-gradient(to bottom right, #FCD34D, #F59E0B)

COMPONENT PROPS:
- setNumber: number (1, 2, 3, ...)
- setType: "warmup" | "working" | "dropset" | "failure"
- weight: number | null
- reps: number | null
- restSeconds: number (default 90)
- completed: boolean
- previousSet: { weight: number, reps: number } | null
- isPR: boolean
- onUpdate: (field: string, value: any) => void
- onComplete: () => void
- onDelete: () => void

LAYOUT (horizontal, 48px min-height, gap 8px):

LEFT - Set Number Badge:
- Circle: 32px diameter
- Background: #35353A
- Text: Set number (14px bold, white)
- Center-aligned

LEFT-2 - Set Type Pill:
- Tap to cycle: warmup → working → dropset → failure → warmup
- Padding: 4px horizontal, 2px vertical
- Border-radius: 6px
- Border: 1px (color based on type)
- Background: Type color at 20% opacity
- Text: Type name (10px, uppercase, semibold, letter-spacing 1.2px)
- Text color: Full saturation type color
- Examples:
  * "WARMUP" - yellow bg, yellow text
  * "WORK" - blue bg, blue text (shortened for space)
  * "DROP" - orange bg, orange text
  * "FAIL" - red bg, red text

CENTER - Inputs (flex, gap 8px):

WEIGHT INPUT:
- Width: 80px
- Height: 40px
- Background: #16161A
- Border: 1px #35353A
- Border-radius: 8px
- Text: 16px semibold, white, center-aligned, tabular-nums
- Placeholder: "0"
- Input mode: decimal
- Label above: "WEIGHT (LBS)" (10px, uppercase, muted, letter-spacing 1.2px)
- Disabled when completed: 40% opacity

REPS INPUT:
- Width: 60px
- Same styling as weight
- Label: "REPS"
- Input mode: numeric

RIGHT - Rest Dropdown:
- Width: 80px
- Height: 40px
- Label: "REST"
- Select: Shows "90s" (or current value)
- Options: 30s, 45s, 60s, 75s, 90s, 120s, 180s
- Dropdown icon: Chevron down

FAR RIGHT - Buttons (gap 4px):

REST TIMER BUTTON:
- Size: 32px square
- Icon: Play (14px)
- Variant: Ghost
- Tap to start rest timer for this exercise

COMPLETE BUTTON:
- Size: 32px circle
- Variant: Secondary (if not completed) or Primary (if completed)
- Icon: Checkmark (if normal) or Trophy (if PR)
- States:
  * Not completed: Border circle, muted
  * Completed: Filled accent blue, white checkmark
  * PR: Gold gradient bg, black trophy icon, glow shadow
- Transition: Scale 1 → 0.95 → 1.05 → 1 on tap (spring animation)

DELETE BUTTON:
- Size: 32px square
- Icon: Trash (14px)
- Variant: Ghost
- Text color: Muted, hover destructive red

BOTTOM ROW (if previousSet exists):
- Margin-top: 8px
- Padding: 8px, background: #1C1C20 (slightly elevated)
- Border: 1px (gold if PR, otherwise #35353A)
- Border-radius: 8px
- Layout: Horizontal, justify-between

LEFT TEXT:
- "LAST: " (11px, muted)
- Previous values: "10 × 135" (11px, semibold, white)
- Separator: "•" (muted)
- "TODAY: " (11px, muted)
- Current values: "12 × 135" (11px, semibold, gold if PR, white otherwise)

RIGHT BADGE (if PR):
- "PR" text + trophy icon
- Background: Gold gradient
- Text: Black (high contrast)
- Padding: 4px horizontal, 2px vertical
- Border-radius: 9999px (pill)
- Font: 11px bold

Transition: All inputs 150ms ease, complete button 300ms spring.
```

---

## 🧩 Reusable Components

### 13. Bottom Navigation

```
Create a bottom navigation bar component (React, mobile, dark mode).

COLORS:
- Background: #16161A (darker than main bg)
- Border: #35353A
- Text inactive: #B3B3B3
- Text active: #4D9FFF (accent)
- Badge: #EF4444 (red)

STRUCTURE:
- Height: 64px + env(safe-area-inset-bottom)
- Width: 100%
- Position: Fixed bottom
- Border-top: 1px #35353A
- Background: #16161A with backdrop-blur(8px) for iOS translucency
- Padding-bottom: env(safe-area-inset-bottom) for iPhone home indicator

NAV ITEMS (5 items, equal width):
- Layout: Flex row, justify-space-around
- Each item: Flex column, align-center, gap 4px

ITEM 1 - Dashboard (active):
- Icon: Home (24px, accent blue)
- Label: "Dashboard" (11px, accent blue, semibold)
- Active indicator: 3px accent bar (above icon, 24px wide, rounded-full)
- OR: Pill background (accent 20% opacity, rounded-full, padding 4px)

ITEM 2 - Workout:
- Icon: Dumbbell (24px, muted)
- Label: "Workout" (11px, muted)
- Inactive state

ITEM 3 - Nutrition:
- Icon: Utensils (24px, muted)
- Label: "Nutrition" (11px, muted)
- Inactive state

ITEM 4 - History:
- Icon: Clock (24px, muted)
- Label: "History" (11px, muted)
- Inactive state

ITEM 5 - Social:
- Icon: Users (24px, muted)
- Label: "Social" (11px, muted)
- Badge: Red dot (8px circle, top-right of icon, absolute)
  * Shows when notifications > 0
  * Number inside if > 9: "12" (9px white text)

TOUCH TARGETS:
- Each item: 48px × 48px minimum (accessibility)
- Padding around icon: 12px all sides
- Tap entire column to navigate

STATES:
- Active: Accent color, bold label, indicator bar/pill
- Inactive: Muted color, regular weight
- Hover (desktop): Slight scale 1.05, 150ms ease
- Tap: Scale 0.95, 100ms ease, then spring back

SAFE AREA:
- iPhone X+: Add padding-bottom equal to safe-area-inset-bottom
- Android: Add 16px padding-bottom for gesture navigation

Z-INDEX: 50 (above content, below modals)
```

---

### 14. Page Header Component

```
Create a reusable page header component (React, mobile, dark mode).

COLORS:
- Background: #0F0F11 (matches page) or transparent with blur
- Text: #FAFAFA
- Border: #35353A

COMPONENT PROPS:
- title: string
- subtitle?: string
- showBack?: boolean (default false)
- rightAction?: ReactNode (button or icon)
- sticky?: boolean (default true)
- blur?: boolean (default false for solid, true for transparent)

STRUCTURE:
- Height: 56px + env(safe-area-inset-top)
- Padding-top: env(safe-area-inset-top) for notched devices
- Border-bottom: 1px #35353A (if sticky)
- Background: #0F0F11 (or rgba(15, 15, 17, 0.8) with backdrop-blur if blur prop)
- Position: Sticky top 0, z-index 40

LAYOUT (horizontal flex, align-center, padding 16px):

LEFT SIDE:
- Back button (if showBack):
  * Icon: Arrow-left (20px)
  * Size: 40px × 40px
  * Variant: Ghost
  * Tap to navigate back

CENTER:
- Title: Flex-1, center-aligned (or left if showBack)
  * Text: 18px semibold, white, truncate
- Subtitle (optional, below title):
  * Text: 12px, muted, truncate

RIGHT SIDE:
- Custom action (if rightAction prop):
  * Common examples:
    - Settings icon button (cog, 20px)
    - Filter icon button (sliders, 20px)
    - Add icon button (plus, 20px)
  * Size: 40px × 40px
  * Variant: Ghost

VARIANTS:

SOLID (default):
- Background: #0F0F11
- No blur

BLUR (sticky header over scrolling content):
- Background: rgba(15, 15, 17, 0.8)
- Backdrop-filter: blur(8px)
- Safari: -webkit-backdrop-filter: blur(8px)

WITH SUBTITLE:
- Title: 16px semibold (smaller)
- Subtitle: 12px muted, margin-top 2px
- Height: 72px (increased to fit both lines)

EXAMPLES:

Dashboard:
- title: "Dashboard"
- showBack: false
- rightAction: <Settings icon button>

Workout Detail:
- title: "Push Day A"
- subtitle: "6 exercises • ~60 min"
- showBack: true
- rightAction: <Edit icon button>

Exercise Picker:
- title: "Add Exercise"
- showBack: false (uses X close button in rightAction)
- rightAction: <X icon button>

Safe area: Padding-top adjusts for iPhone notch automatically.
```

---

### 15. Stat Card Component

```
Create a large statistic display card (React, dark mode).

COLORS:
- Card: #1C1C20
- Border: #35353A
- Text: #FAFAFA
- Muted: #B3B3B3
- Accent: #4D9FFF
- Success: #34D399 (green, for positive trends)
- Warning: #EF4444 (red, for negative trends)

COMPONENT PROPS:
- label: string (e.g., "Total Volume")
- value: string | number (e.g., "24.5K" or 24500)
- unit?: string (e.g., "lbs", "kcal", "min")
- trend?: "up" | "down" | "neutral"
- trendValue?: string (e.g., "+12%", "-5%")
- sparkline?: number[] (optional mini chart data)
- icon?: ReactNode (optional icon)

STRUCTURE:
- Width: Full (mobile) or 160px (grid)
- Height: Auto (min 120px)
- Border: 1px #35353A
- Border-radius: 16px
- Background: linear-gradient(135deg, #1C1C20, #16161A)
- Padding: 20px
- Shadow: 0 2px 8px rgba(0, 0, 0, 0.2)

LAYOUT (vertical flex, gap 12px):

TOP ROW (horizontal, justify-between):
- Left: Label (12px, uppercase, muted, letter-spacing 1.2px)
- Right: Icon (20px, muted) if provided

VALUE ROW:
- Value: Large number (32px bold, white, tabular-nums)
- Unit: Small text (14px, muted, margin-left 4px)
- Example: "24.5K" + "lbs"

TREND ROW (if trend prop exists):
- Layout: Horizontal, align-center, gap 6px
- Trend icon:
  * Up: Arrow-up (14px, green)
  * Down: Arrow-down (14px, red)
  * Neutral: Minus (14px, muted)
- Trend value: "12%" (14px, color matches icon)

SPARKLINE (if data provided):
- Height: 32px
- Width: Full
- Margin-top: 8px
- SVG line chart:
  * Stroke: Accent blue
  * Stroke-width: 2px
  * Fill: Accent gradient (from accent 20% to transparent)
  * Smooth curve: Use quadratic bezier
- Renders last 7-14 data points

VARIANTS:

PRIMARY (accent color):
- Border: 2px accent blue
- Icon: Accent blue

SUCCESS (green theme):
- Value: Green color
- Border: 1px green 30% opacity

WARNING (yellow theme):
- Value: Yellow color
- Border: 1px yellow 30% opacity

LARGE (dashboard hero stat):
- Value: 48px bold
- Height: 160px
- Add decorative gradient background

Transition: Hover lift 2px, shadow increase, 200ms ease-out.
```

---

## 📦 Usage Instructions

### How to Use These Prompts:

1. **Go to v0.dev**: https://v0.dev
2. **Copy a prompt** from above
3. **Paste into v0.dev** chat
4. **Generate** — v0 will create React + Tailwind code
5. **Iterate** — Ask v0 to adjust colors, spacing, or add features
6. **Export** — Copy code to your project or download as component

### Tips for Best Results:

- **Start with components** (Macro Ring, Set Row) before full pages
- **Combine prompts**: "Use the Macro Ring component in the Dashboard screen"
- **Iterate**: After generation, ask "Make the buttons larger" or "Add a hover state"
- **Test responsive**: Ask "Show this at tablet width (768px)"
- **Request variants**: "Create a light mode version" or "Show loading state"

### Common Follow-Up Prompts:

After generating a component, refine with:

```
"Make the text larger and add more padding"
"Add a loading skeleton state"
"Show this with sample data populated"
"Add smooth animations when the value changes"
"Make this work at tablet size (2 columns)"
"Add a hover state that lifts the card"
"Show error state when data fails to load"
```

### Combining Components:

Once you have individual components, compose full screens:

```
"Create the Dashboard screen using:
- The Page Header component for the title
- 3 Stat Card components for volume/workouts/calories
- The Macro Ring component (3 rings horizontal)
- The Bottom Navigation component
Layout them vertically with 16px gaps"
```

---

## 🎨 Design Token Reference

For easy copy-paste when iterating:

```css
/* Colors */
--background: #0F0F11
--card: #1C1C20
--elevated: #252529
--border: #35353A
--text: #FAFAFA
--muted: #B3B3B3
--accent: #4D9FFF
--success: #34D399
--warning: #FCD34D
--error: #EF4444

/* Macro Colors */
--protein: #60A5FA
--carbs: #FCD34D
--fat: #F472B6
--fiber: #4ADE80

/* Set Type Colors */
--warmup: #FCD34D
--working: #4D9FFF
--dropset: #FB923C
--failure: #EF4444

/* Gradients */
--fire: linear-gradient(to right, #FB923C, #EF4444)
--gold: linear-gradient(to bottom right, #FCD34D, #F59E0B)
--card: linear-gradient(135deg, #1C1C20, #16161A)

/* Spacing */
--gap-sm: 8px
--gap-md: 16px
--gap-lg: 24px

/* Border Radius */
--radius-sm: 8px
--radius-md: 12px
--radius-lg: 16px
--radius-xl: 24px
```

---

## 🚀 Next Steps

1. **Generate Dashboard first** — Highest visibility, sets the tone
2. **Build component library** — Macro Ring, Stat Card, Set Row
3. **Compose full screens** — Use components in Workout, Nutrition, History
4. **Export to Figma** — Use v0's Figma export for design handoff
5. **Implement in codebase** — Copy generated code directly into Fit-Hub

Each prompt generates production-ready code. Just customize the data sources and API calls to match your Supabase schema!
