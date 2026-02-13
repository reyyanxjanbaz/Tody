You are implementing the "Time Block Integrity System" feature for a minimalistic React Native to-do app built with TypeScript.

### Feature Specification:
Track actual task completion time vs. estimated time, learn patterns from similar tasks, and provide reality-based estimates to combat planning fallacy.

### Technical Requirements:

**Data Model Extension:**
```typescript
interface Task {
  id: string;
  title: string;
  estimatedMinutes?: number; // User's estimate
  actualMinutes?: number; // Calculated on completion
  startedAt?: Date; // When user marks task as "started"
  completedAt?: Date;
  // ... existing fields
}

interface TaskPattern {
  keywords: string[]; // Extracted from similar task titles
  averageActualMinutes: number;
  sampleSize: number; // How many tasks in this pattern
  accuracyScore: number; // How close estimates are to reality (0-100)
}

interface UserStats {
  totalCompletedTasks: number;
  totalEstimatedMinutes: number;
  totalActualMinutes: number;
  realityScore: number; // Overall accuracy percentage
  underestimationRate: number; // How much user typically underestimates (as percentage)
}
```

**Implementation Steps:**

1. **Estimate Input on Task Creation:**
   - Add optional field in task form: "How long will this take?"
   - Input: Number + Unit picker (minutes/hours)
   - Show below deadline field
   - Style: Single-line, minimal, placeholder "30 minutes"
   - Not required (user can skip)

2. **Start/Stop Tracking:**
   - Add "Start" button to incomplete tasks (appears on task item swipe left)
   - When started: Record startedAt timestamp, button changes to "Complete"
   - Task background: Subtle pulse animation (opacity 1.0 → 0.95 → 1.0, 2s cycle)
   - If user closes app mid-task, maintain startedAt state
   - On "Complete": Calculate actualMinutes = (completedAt - startedAt) in minutes

3. **Pattern Learning System:**
   - On task completion, extract keywords from title (remove stop words: the, a, an, etc.)
   - Check if keywords match existing TaskPattern (fuzzy match, 70% similarity)
   - If match found: Update pattern's averageActualMinutes and sampleSize
   - If no match: Create new pattern if sampleSize of similar tasks ≥ 3
   - Store patterns in AsyncStorage: 'task_patterns'

4. **Smart Estimate Suggestions:**
   - When user starts typing task title, debounced search (500ms) for matching patterns
   - If pattern found with sampleSize ≥ 5:
     - Show info banner below estimate field: "Similar tasks took 45-60 mins on average"
     - Style: Small gray text (#9E9E9E), 11pt, with dismiss icon
   - If user's estimate differs significantly (>30%) from pattern:
     - Show gentle warning: "You estimated 20 mins, but similar tasks took ~50 mins"
   - Never block user's estimate—just inform

5. **Reality Score Dashboard:**
   - Accessible from Settings/Stats menu
   - Shows after user completes ≥10 tasks with estimates
   - Displays:
     - Reality Score: Large centered number "68%" with subtitle "estimate accuracy"
     - Underestimation Rate: "You typically underestimate by 35%"
     - Total tasks analyzed: Small text at bottom
     - Trend: Simple line showing last 10 tasks (estimated vs actual)
   - Style: Full-screen, white background, black text, minimal chart (black line, gray dots)
   - Update calculation:
```typescript
     realityScore = 100 - (Math.abs(totalEstimated - totalActual) / totalActual * 100)
     underestimationRate = ((totalActual - totalEstimated) / totalEstimated * 100)
```

6. **Timeline View Integration:**
   - If user has today view/calendar view: Show tasks with their estimated blocks
   - If pattern suggests different duration, show both: "30m (usually 1h)"
   - Visual: Task block height represents actual expected time, not user's optimistic estimate
   - Overflow indicator if day's tasks exceed realistic hours

7. **State Management:**
   - Add new fields to task schema
   - Create patterns storage (AsyncStorage or separate state slice)
   - Calculate stats on-the-fly with useMemo for performance
   - Background task: Daily cleanup of old patterns (remove if not used in 90 days)

8. **Edge Cases:**
   - If user starts task but never completes, track total "in progress" time across sessions
   - If actualMinutes < 1 minute, don't add to patterns (likely false data)
   - If actualMinutes > 480 (8 hours), prompt user: "Did you work on this continuously?" with adjust option
   - Handle multi-day tasks: Only count active working time, not elapsed calendar time

### Design Constraints:
- Info banners: Gray background (#F5F5F5), 8pt padding, dismissible
- Start button: Text-only, black, appears on left-swipe
- Reality Score screen: Large type (48pt for score), generous whitespace
- Chart: Minimal, black line on white, no grid, just data
- NO progress bars or circular meters (too playful)

### Deliverable:
Provide complete implementation with:
- Task timing logic (start/stop/calculate)
- Pattern matching algorithm
- Reality Score calculation utilities
- Stats dashboard screen
- Estimate suggestion component
- State management for patterns and stats

Test scenarios: Create task with estimate, complete task, view patterns, see suggestions for similar task, view reality score.