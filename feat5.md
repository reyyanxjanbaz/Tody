You are implementing the "Energy Zones" feature for a minimalistic React Native to-do app built with TypeScript.

### Feature Specification:
Tag tasks with energy requirements (High Focus, Medium, Low Lift) and provide single-tap filters to show only tasks matching current cognitive state. No AI predictions—user-controlled cognitive load matching.

### Technical Requirements:

**Data Model Extension:**
```typescript
type EnergyLevel = 'high' | 'medium' | 'low';

interface Task {
  id: string;
  title: string;
  energyLevel: EnergyLevel; // Required field for all tasks
  // ... existing fields
}

interface FilterState {
  activeEnergyFilter: EnergyLevel | 'all';
}
```

**Implementation Steps:**

1. **Energy Level Selection on Task Creation:**
   - Add energy selector in task creation form (below priority field)
   - Label: "Energy required" (not "difficulty" or "complexity")
   - Three options: "High Focus" | "Medium" | "Low Lift"
   - Visual: Segmented control (three equal buttons, full width)
   - Selected state: Black background, white text
   - Unselected state: White background, black text, 1px black border
   - Default: Pre-select "Medium" (most tasks fall here)
   - Required field: Cannot create task without selecting

2. **Visual Indication in Task List:**
   - DO NOT show emoji or colored badges
   - Use typography weight to indicate energy:
     - High Focus: Bold title (font weight 600)
     - Medium: Regular title (font weight 400)
     - Low Lift: Light title with slightly smaller font (font weight 300, 14pt vs 16pt)
   - Keep all text black, no color coding
   - Subtle: Should be noticeable but not dominate visual hierarchy

3. **Filter Buttons Implementation:**
   - Position: Top of task list, below header, above tasks
   - Layout: Horizontal row, 4 buttons with equal spacing
   - Button labels: "All" | "High" | "Medium" | "Low"
   - Button style:
     - Active: Black background, white text, 0 border radius (sharp edges)
     - Inactive: White background, black text, 1px black border
     - Size: 60pt width, 32pt height, 12pt font
     - Spacing: 8pt gap between buttons
   - Default state: "All" selected
   - Tap: Instant filter (no animation), update activeEnergyFilter state

4. **Filtering Logic:**
   - When filter active: Only show tasks matching selected energy level
   - Keep subtask hierarchy visible: If child matches but parent doesn't, show both (maintain context)
   - Show count: Small text below filters: "12 tasks" (updates based on filter)
   - Empty state: If no tasks match filter, show: "No [high/medium/low] energy tasks"
   - Persist filter state: User's last selected filter persists across app sessions (AsyncStorage)

5. **Editing Energy Level:**
   - Swipe left on task → Reveals "Edit" button
   - Edit screen: Shows energy selector (same as creation form)
   - Update immediately on selection change
   - If filter active and energy change moves task out of view, show brief toast: "Task moved to [energy level]"

6. **Smart Defaults (No AI, Just Heuristics):**
   - When user creates task, if title contains certain keywords, suggest energy level:
     - "write", "design", "plan", "strategy" → Suggest "High Focus"
     - "call", "email", "review", "check" → Suggest "Medium"
     - "respond", "forward", "pay", "buy" → Suggest "Low Lift"
   - Show suggestion as pre-selected button, but user can change
   - Store user's overrides: If user always changes "call" from medium to low, learn preference

7. **Integration with Time of Day (Optional Enhancement):**
   - If user has completed >30 tasks, analyze patterns:
     - What energy tasks do they complete in morning vs evening?
   - Subtle suggestion banner (dismissible): "You usually do high focus tasks in the morning"
   - Position: Top of screen, only shows once per week
   - NO push notifications or reminders (user pulls information, app doesn't push)

8. **State Management:**
   - Add energyLevel field to task schema (required, default 'medium')
   - Create filter context/state: activeEnergyFilter
   - Persist filter selection: AsyncStorage key 'energy_filter_preference'
   - Filter application: Use useMemo to filter tasks based on activeEnergyFilter
```typescript
   const filteredTasks = useMemo(() => {
     if (activeEnergyFilter === 'all') return tasks;
     return tasks.filter(task => task.energyLevel === activeEnergyFilter);
   }, [tasks, activeEnergyFilter]);
```

9. **Edge Cases:**
   - If 95%+ of tasks are one energy level, show suggestion: "Vary task energy to match your state"
   - If user never uses filter, don't push it (silent feature)
   - If filter active and user creates task outside filter, briefly highlight filter bar
   - Migration: Existing tasks without energyLevel default to 'medium'

### Design Constraints:
- NO colored energy badges (red/yellow/green)
- NO emoji indicators
- Typography weight is ONLY energy indicator
- Filter buttons: Sharp edges (0 border radius), black/white only
- Active filter: Black background with white text (high contrast)
- Task count: Gray text (#9E9E9E), 11pt, subtle

### Deliverable:
Provide complete implementation with:
- Energy level selector component (segmented control)
- Task list typography differentiation
- Filter button row with state management
- Filter logic with hierarchy preservation
- Edit energy level flow
- Keyword-based suggestion logic
- State persistence

Test scenarios: Create tasks with different energy levels, filter by each level, verify typography weights, edit energy level, check persistence across app restarts, view empty state for unused energy filter.