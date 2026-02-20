# Responsive Layout Guide for Fit-Hub

## Container Width Standards

### Mobile-First Approach
All pages use mobile-first responsive design with progressive enhancement for larger screens.

### Max-Width Standards by Page Type

**Single-Column Content (Forms, Focused Tasks)**
- `max-w-lg` (32rem / 512px)
- Use for: Settings, Nutrition Goals, Nutrition Scan, Pod forms
- Examples: `/settings`, `/nutrition/goals`, `/nutrition/scan`

**Medium Content (Social, Profiles)**
- `max-w-2xl` (42rem / 672px)
- Use for: User profiles, edit pages, progress charts
- Examples: `/social/[userId]`, `/history/progress`, `/templates/[id]/edit`

**Wide Content with Sidebars (Dashboard, History)**
- `max-w-7xl` (80rem / 1280px)
- Use for: Pages with potential sidebar layouts
- Examples: `/dashboard`, `/history`, `/nutrition`, `/workout`

**Social Feed**
- `max-w-4xl` (56rem / 896px)
- Use for: Content feeds, discovery
- Examples: `/social`, `/analytics`

## Grid Patterns

### Stat Cards
```tsx
// ❌ Bad: No responsive breakpoints
<div className="grid grid-cols-3 gap-3">

// ✅ Good: Responsive spacing
<div className="grid grid-cols-3 gap-2 sm:gap-3">
```

### Macro/Nutrition Data
```tsx
// ❌ Bad: Too many columns on mobile
<div className="grid grid-cols-4 gap-3">

// ✅ Good: 2 cols mobile, 4 cols tablet+
<div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
```

### Action Buttons
```tsx
// ✅ Good: Full width on mobile, grid on larger screens
<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
  <Button>Action 1</Button>
  <Button>Action 2</Button>
  <Button>Action 3</Button>
</div>
```

### Macro Rings
```tsx
// ✅ Good: 2 cols always, responsive spacing
<div className="grid grid-cols-2 gap-3 sm:gap-4">
  <MacroRing ... />
  <MacroRing ... />
</div>
```

## Spacing Scale

### Gap Sizes (Mobile → Tablet → Desktop)
- **Tight**: `gap-2` → `sm:gap-3` → `md:gap-4`
- **Standard**: `gap-3` → `sm:gap-4` → `md:gap-5`
- **Loose**: `gap-4` → `sm:gap-5` → `md:gap-6`

### Padding/Margin (Mobile → Tablet)
- **Page containers**: `px-4 pb-28 pt-6` → `md:px-6`
- **Cards**: `p-4` → `sm:p-6`
- **Sections**: `space-y-4` → `sm:space-y-5` → `md:space-y-6`

## Touch Targets

### Minimum Sizes (WCAG 2.5.5 AA)
- All interactive elements: **min-height: 44px**
- Buttons: `h-12` (48px) or larger
- Icon buttons: `size-10` (40px) minimum
- Touch padding: `p-3` (12px) minimum for icon-only buttons

```tsx
// ✅ Good: Adequate touch target
<Button className="h-12 w-full">Start Workout</Button>

// ❌ Bad: Too small for touch
<Button className="h-8">Action</Button>
```

## Typography Scale

### Responsive Text Sizes
Use fluid typography from design tokens:
```tsx
// Desktop hero
<h1 className="text-xl sm:text-2xl">Hero Title</h1>

// Body text
<p className="text-sm sm:text-base">Body content</p>

// Metadata
<span className="text-xs">Metadata</span>
```

## Common Patterns

### Page Container
```tsx
<div className="mx-auto w-full max-w-7xl space-y-6 px-4 pb-28 pt-6 md:px-6">
  {/* Page content */}
</div>
```

### Card Grid
```tsx
<div className="grid gap-4 lg:grid-cols-2">
  <Card>...</Card>
  <Card>...</Card>
</div>
```

### Stat Card Row
```tsx
<div className="grid grid-cols-3 gap-2 sm:gap-3">
  <StatCard ... />
  <StatCard ... />
  <StatCard ... />
</div>
```

### Form Layout
```tsx
<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
  <Input ... />
  <Input ... />
</div>
```

## Breakpoints (Tailwind Defaults)

- **sm**: 640px (Tablet portrait)
- **md**: 768px (Tablet landscape)
- **lg**: 1024px (Small desktop)
- **xl**: 1280px (Large desktop)
- **2xl**: 1536px (XL desktop)

## Testing Checklist

### Mobile (375px - 640px)
- [ ] All text is readable without horizontal scroll
- [ ] Buttons are at least 44px tall
- [ ] Images/videos don't overflow
- [ ] Grids collapse to 1-2 columns
- [ ] Bottom nav doesn't overlap content (pb-28)

### Tablet (640px - 1024px)
- [ ] 2-3 column grids where appropriate
- [ ] Increased spacing (gap-3, gap-4)
- [ ] Comfortable reading width
- [ ] No wasted whitespace

### Desktop (1024px+)
- [ ] Max-width containers prevent line lengths >80ch
- [ ] Multi-column layouts where beneficial
- [ ] Sidebar layouts for dashboard pages
- [ ] Hover states on interactive elements

## Common Issues to Avoid

1. **Fixed 3+ column grids on mobile** → Use `grid-cols-1 sm:grid-cols-3`
2. **No responsive spacing** → Use `gap-2 sm:gap-3`
3. **Text overflow** → Use `truncate` or `line-clamp-*`
4. **Small touch targets** → Min 44px height
5. **No container max-width** → Always use `max-w-*`
6. **Inconsistent padding** → Follow `px-4 md:px-6` pattern
