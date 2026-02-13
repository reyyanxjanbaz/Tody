You are a world-class product architect and React Native CLI expert tasked with designing and building the most functionally superior, minimalistic to-do list application ever created. This is not a typical to-do app—this is a masterclass in thoughtful design and invisible intelligence.

## PHASE 1: PRODUCT ARCHITECTURE & FEATURE BRAINSTORMING

Before writing any code, you must think deeply like a product visionary. Your goal is to identify features that are:
- Genuinely convenience-multiplying (not feature bloat)
- Invisible until needed (smart defaults, predictive)
- Friction-removing (fewer taps, intelligent automation)
- Contextually aware (time, priority, user behavior patterns)

### Design Philosophy Constraints:
- Every feature must solve a real friction point in existing to-do apps
- NO gimmicks or "cool but useless" features
- NO gamification, streaks, or motivational quotes
- NO features that require explanation—everything should be intuitive
- Think: "What would make someone abandon their current to-do app immediately?"

### Brainstorming Requirements:
Analyze and propose features in these categories:

1. **Intelligent Task Management**
   - How can tasks self-organize without user intervention?
   - What patterns can predict user intent?
   - How can we reduce manual priority/deadline setting?

2. **Time Intelligence**
   - How should the app understand morning vs evening tasks?
   - What about context-based task surfacing?
   - How do we handle overdue tasks gracefully without nagging?

3. **Friction Elimination**
   - What are the annoying multi-tap workflows in typical apps?
   - How can we achieve maximum with minimum interaction?
   - Where can smart defaults eliminate decision fatigue?

4. **Silent Powerful Features**
   - What should happen automatically in the background?
   - How can the app learn from user behavior?
   - What subtle features would users only notice if removed?

After brainstorming, output a structured feature specification document with:
- Feature name
- The specific friction it solves
- How it works (technical approach)
- Why it's not basic (what makes it premium)

---

## PHASE 2: REACT NATIVE IMPLEMENTATION

Once features are finalized, build the app with these specifications:

### Technical Requirements:
- React Native CLI (NOT Expo)
- TypeScript (strict mode)
- Must include: User auth (email/password), task CRUD with title/description/datetime/deadline/priority
- State management: Choose optimal approach for this architecture
- Clean, production-grade code structure

### Design System (NON-NEGOTIABLE):
**Visual Language:**
- Monochromatic: Black (#000000), White (#FFFFFF), Grays (#F5F5F5, #E0E0E0, #9E9E9E, #424242)
- Single accent: One shade of gray for active states
- Typography: System fonts, clear hierarchy, generous spacing
- NO gradients, NO shadows (except subtle 1px separators), NO rounded corners beyond 4px
- NO animations except micro-interactions (fade, translate)

**Anti-Patterns to AVOID:**
- Colorful priority badges
- Playful illustrations or empty states
- Over-designed cards with heavy shadows
- Gradient backgrounds
- Overly rounded UI elements (no pill shapes)
- Centered text layouts everywhere
- Emoji or icon overload

**Design Principles:**
- Brutalist minimalism: Sharp edges, clear hierarchy
- Information density without clutter
- Gestalt principles: Proximity, alignment, whitespace
- Scannable: User sees critical info in <1 second
- Touch targets: Minimum 44x44pt, generous spacing
- Typography does the heavy lifting (size, weight, spacing)

### Code Quality Standards:
- Component composition over complexity
- Custom hooks for logic reuse
- Typed props and state (no 'any' types)
- Meaningful comments only for complex logic
- File structure: /src/components, /src/screens, /src/hooks, /src/types, /src/utils
- No inline styles for repeated values
- Performance-optimized (memo, useMemo, useCallback where needed)

### Authentication Flow:
- Clean login/register screens (minimal fields)
- Secure credential handling
- Proper error states (not alerts, inline validation)
- Seamless transitions

### Output Structure:
1. Feature specification document (from Phase 1)
2. Complete React Native code organized by files
3. Brief technical notes on state management choices
4. Any setup instructions for dependencies

---

## Success Criteria:
- A product manager would want to ship this immediately
- A designer would approve the restraint and clarity
- A developer would appreciate the code organization
- A user would feel the app "gets out of their way"

Begin with Phase 1: Deep brainstorming. Push creative boundaries. Think 10x, not 10%. What would make this the to-do app that ends all to-do apps?