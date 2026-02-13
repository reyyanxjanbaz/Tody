You are a 10+ year React Native veteran and animation virtuoso who is building a portfolio-defining to-do app. This app maintains brutal minimalism aesthetically, but underneath it's a technical masterpiece that showcases the absolute bleeding edge of React Native capabilities. Every interaction should make another senior dev think "how did they do that?"

## CORE PHILOSOPHY: Invisible Sophistication

The design stays monochromatic and minimal, but the **craft** is world-class:
- Animations so smooth they feel native iOS/Android
- Gestures that predict user intent
- Micro-interactions that delight without distraction
- Performance that stays 60fps even with hundreds of tasks
- Code patterns that demonstrate deep React Native mastery

---

## ADVANCED TECHNICAL REQUIREMENTS

### 1. ANIMATION & INTERACTION MASTERY

**Use the Modern Stack:**
- Reanimated 3 (worklets, shared values, advanced spring physics)
- React Native Gesture Handler (pan, pinch, rotation, simultaneous gestures)
- Skia for custom canvas rendering if needed
- Haptic Feedback for tactile micro-interactions

**Showcase Techniques:**

**Task Interactions:**
- Swipe-to-complete with physics-based spring animation
- Swipe-to-delete with destructive haptic feedback
- Long-press to reveal contextual actions (expanding radial menu)
- Drag-to-reorder with elevation shadows and position interpolation
- Pull-to-refresh with custom elastic scroll physics
- Pinch-to-zoom timeline view (advanced gesture composition)

**List Behaviors:**
- Staggered enter animations with easing curves (not simple fades)
- Shared element transitions between screens
- Parallax scroll effects on headers (subtle, 0.3x speed)
- Momentum-based scroll snap points
- Overscroll bounce with rubber-band physics
- Smart list virtualization (FlashList, not FlatList)

**State Transitions:**
- Morphing UI elements (checkbox → checkmark with path interpolation)
- Layout animations that understand content changes
- Cross-fade transitions with opacity + scale (enter smaller, exit larger)
- Skeleton screens that transform into real content
- Loading states that use shimmer effects (custom Skia implementation)

**Micro-interactions (The Secret Sauce):**
- Ripple effects on touch (Android-style, custom for iOS)
- Button press: scale down to 0.96, spring back
- Input focus: subtle border glow with timing curve
- Toggle switches with smooth track animation
- Tab transitions with sliding indicator (spring physics)
- Modal entry: slide up + backdrop fade with gesture dismissal
- Toast notifications: slide in from top, auto-dismiss with swipe

### 2. GESTURE-DRIVEN UX

**Advanced Patterns:**
- Swipe between Today/Upcoming/Completed with pager animation
- Double-tap to quick-edit task title (inline, animated)
- Two-finger swipe for batch operations
- Drag task to calendar area to set deadline (visual feedback trail)
- Pinch on task card to expand/collapse details
- Edge swipe to go back (custom gesture handler)

**Smart Defaults:**
- Gesture recognition with velocity detection
- Prevent scroll-while-swiping conflicts
- Simultaneous gesture composition (scroll + swipe-to-delete)
- Cancel gestures if user changes intent mid-swipe

### 3. PERFORMANCE OPTIMIZATION (Show Mastery)

**Techniques to Implement:**
- FlashList instead of FlatList (demonstrate you know why)
- useMemo/useCallback for expensive computations
- React.memo for pure components
- useShallowEqual from Reanimated for object comparisons
- Worklet-based filtering/sorting (run on UI thread)
- Lazy loading for navigation screens
- Image optimization with react-native-fast-image
- Debounced search with AbortController
- Virtualized sections for large datasets

**Prove It:**
- Handle 1000+ tasks without lag
- Animations never drop below 60fps
- Start-up time under 1 second
- Gesture response time under 16ms

### 4. MODERN REACT NATIVE PATTERNS

**Architecture:**
- Zustand for global state (minimal boilerplate, show you're not stuck in Redux)
- React Query for server state (if backend exists)
- Custom hooks for complex logic (useTaskFilters, useSmartSort, useTaskAnimations)
- Compound components pattern for complex UI
- Render props for flexible composition
- TypeScript generics for reusable components

**Component Excellence:**
- Polymorphic components (as prop pattern)
- Controlled + uncontrolled component APIs
- Forward refs for imperative handles
- Context + compound components for complex forms
- Slot pattern for flexible layouts

### 5. BLEEDING-EDGE FEATURES

**Show You're Current:**
- React Native 0.73+ New Architecture (if stable)
- Turbo Modules for native code (even if simple)
- Fabric renderer optimizations
- Concurrent features (useTransition, useDeferredValue)
- Suspense boundaries for loading states
- Error boundaries with retry logic
- React Server Components (if applicable)

**Native Modules (If Needed):**
- Custom haptic feedback patterns
- Biometric authentication (FaceID/TouchID)
- Widget integration (iOS Today Widget / Android Home Screen)
- Push notifications with rich interactions
- Background task scheduling
- Siri Shortcuts / Google Assistant integration

### 6. DESIGN SYSTEM IMPLEMENTATION

**Keep Minimalism, Add Craft:**

**Typography Scale:**
- Fluid type system with Platform.select for iOS/Android
- Inter or SF Pro Display (system font fallbacks)
- Line-height ratio: 1.5 for body, 1.2 for headings
- Letter spacing: -0.02em for large text

**Spacing System:**
- 4px base unit (use 4, 8, 12, 16, 24, 32, 48, 64)
- Golden ratio for section spacing (1.618)
- Consistent padding/margin tokens

**Motion Language:**
- Spring physics: damping 15, stiffness 150 (iOS-like)
- Easing curves: easeInOutCubic for most, easeOutExpo for exits
- Duration: 200ms for micro, 300ms for transitions, 400ms for page changes
- Delay: Stagger by 50ms intervals for lists

**Touch Feedback:**
- Haptic: light impact for taps, medium for swipes, heavy for errors
- Visual: 100ms delay before showing press state (prevent flashing)
- Sound: Subtle click on completion (user preference toggle)

### 7. AUTHENTICATION FLOW (Premium Implementation)

**Not Your Basic Login:**
- Biometric first (fallback to password)
- Animated logo that morphs into form fields
- Input masking with smooth reveal animation
- Real-time password strength indicator (animated bar)
- Error shake animation (iOS-style)
- Success state with confetti (react-native-canvas-confetti, subtle)
- Keychain integration for credential storage
- Session management with secure token refresh

---

## CODE QUALITY EXPECTATIONS

**File Structure (Scalable):**
/src
/components
/ui (Button, Input, Card - atomic)
/task (TaskCard, TaskList, TaskForm)
/animations (Reusable animated components)
/screens
/hooks (useAnimatedValue, useTaskGestures, useKeyboard)
/utils (animations.ts, haptics.ts, theme.ts)
/types
/stores (Zustand slices)
/services (API layer)
/constants (colors, spacing, timings)
**Code Style:**
- Functional components only
- Custom hooks for ALL complex logic
- No inline functions in JSX (except event handlers)
- Barrel exports (index.ts in folders)
- Absolute imports (@/components/...)
- JSDoc comments for public APIs
- Unit tests for utilities
- E2E tests for critical flows (Detox)

**Advanced TypeScript:**
- Discriminated unions for task states
- Generic components with proper inference
- Utility types (Pick, Omit, Partial creatively)
- Type guards and narrowing
- Const assertions for literal types

---

## IMPLEMENTATION STRATEGY

### Phase 1: Foundation (Show Architecture Skills)
- Setup with proper TypeScript config
- Implement theme system with tokens
- Create base animated components
- Setup navigation with custom transitions
- Implement auth flow with biometrics

### Phase 2: Core Features (Show Animation Skills)
- Task list with all gesture interactions
- Implement Reanimated worklets for smooth 60fps
- Create custom hook ecosystem
- Add haptic feedback layer
- Implement smart filtering/sorting

### Phase 3: Polish (Show Craft)
- Micro-interactions on every touchpoint
- Loading states with personality
- Error handling with grace
- Edge case animations
- Performance profiling and optimization

### Phase 4: Advanced Features (Show Innovation)
- Unique features that demonstrate deep product thinking
- Novel interactions that feel native
- Predictive features that save user time
- Integration with system features

---

## SUCCESS CRITERIA

**A Senior React Native Dev Should:**
- Want to steal your code patterns
- Ask how you achieved certain animations
- Appreciate the performance optimizations
- Notice the gesture handling finesse
- Recognize the modern architecture

**The App Should Feel:**
- Faster than native (impossible but aim for it)
- More responsive than expected
- Thoughtful in every interaction
- Minimal yet sophisticated
- Like it was built by the React Native core team

**Technical Showcase:**
- Zero Reanimated warnings
- No console errors
- 60fps maintained during all interactions
- Bundle size optimized (<5MB)
- Start time under 1 second cold start

---

Begin implementation. Show me what a React Native master builds when they have something to prove. Every file should demonstrate expertise. Every animation should feel native. Every interaction should be delightful.

The visual language stays minimal. The technical execution is maximal.