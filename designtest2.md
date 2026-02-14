# UI Overhaul Master Plan: The "Dynamic Capsule" Theme

**Objective:**
Refactor the entire UI of the generic "Tody" app to match the design language of the new "ProcessInbox" floating dock. The goal is a high-contrast, tactile, modern aesthetic defined by **Floating Dark Capsules**, **Deep Shadows**, and **Heavy Rounded Corners**.

**Core Design Principles (The "Source of Truth"):**
1.  **Forms:** Everything is a capsule (pill-shape) or deeply rounded card (`borderRadius: 24-32`).
2.  **Depth:** High elevation (`shadowOpacity: 0.25`, `radius: 16`) to make elements feel like physical objects floating above the canvas.
3.  **Contrast:** Heavy use of `#1C1C1E` (Off-Black) for primary interactables against a clean `#FFFFFF` or `#F5F5F7` background.
4.  **Glass/Translucency:** Subtle use of `rgba(255,255,255,0.1)` for internal separators or secondary states within dark containers.
5.  **Typography:** Bold, weighty headers (`fontWeight: 700`) to match the heavy UI elements.

---

## Execution Phases & Tasks

### Phase 1: Design Tokens & Global Styles
*   [ ] **Update `src/utils/colors.ts`:**
    *   Add `Colors.surfaceDark: '#1C1C1E'` (The Dock Color).
    *   Add `Colors.surfaceGlass: 'rgba(255,255,255,0.1)'`.
    *   Add `Shadows.floating`: A predefined shadow object `{ shadowColor: '#000', shadowOffset: {height: 8}, shadowOpacity: 0.2, shadowRadius: 16, elevation: 8 }`.
    *   Add `BorderRadius.pill: 100` and `BorderRadius.card: 24`.
*   [ ] **Create `src/components/ui/CapsuleButton.tsx`:** A reusable component replacing standard buttons, implementing the black pill style from ProcessInbox.

### Phase 2: Navigation & Layout
*   [ ] **Redesign Bottom Navigation (`HomeScreen.tsx`):**
    *   Remove the full-width edge-to-edge `bottomNavBar`.
    *   Replace it with a **Floating Tab Bar**: A detached, rounded rectangle floating 24px from the bottom/sides.
    *   Style: Dark background (`#1C1C1E`), white icons.
    *   Active state: A subtle glass-pill background behind the active icon.
*   [ ] **Refactor Screen Headers (`components/SectionHeader.tsx`, etc.):**
    *   Increase title size to standard iOS "Large Title" feel.
    *   Remove thin hairlines (`borderBottomWidth`). Use whitespace to separate headers from content.

### Phase 3: Component Transformation
*   [ ] **Task Items (`components/TaskItem.tsx`):**
    *   Change from list-view (lines) to **Card View**.
    *   Each task becomes a white box with `borderRadius: 20` and `Shadows.floating` (scaled down slightly).
    *   Checkbox: Make it a circular container with a bold checkmark (matching the circle buttons).
*   [ ] **Input Fields (`components/TaskInput.tsx`):**
    *   Transform inputs into gray/off-white capsules (`borderRadius: 16`, `backgroundColor: '#F2F2F7'`).
    *   Remove bottom-border-only styling; go for full "pill" inputs.
*   [ ] **FABs & Triggers (`components/QuickCaptureFAB.tsx`):**
    *   Ensure the main FAB matches the "Memo" circular button exactly (Dark, bold white icon, heavy shadow).

### Phase 4: Screen-Specific Polish
*   [ ] **Inbox / ProcessInbox Screen:**
    *   Update the "Swipe Cards" to have the same corner radius as the dock (`32px`).
    *   Ensure the background is slightly off-white (`#F5F5F5`) so the white cards pop.
*   [ ] **Focus Mode (`components/FocusMode.tsx`):**
    *   Use the dark theme inverted: Dark background for the screen, white glowing text, white floating controls.

### Phase 5: Micro-Interactions
*   [ ] **Haptics:** Ensure every "Capsule" press triggers a `heavy` or `rigid` haptic feedback to mimic the visual weight of the buttons.
*   [ ] **Press States:** Implement `scale: 0.95` animation on all floating elements when pressed (squishy tactile feel).

---

**Instruction to Agent:**
Execute these phases sequentially. Do not simply patch existing styles; **refactor the component structure** if necessary to support the "Floating" architecture (e.g., changing Views to Absolute positioned containers for docks). Verify standard TypeScript compliance after each file modification.