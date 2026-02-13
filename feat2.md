You are implementing the "Natural Decay" feature for a minimalistic React Native to-do app built with TypeScript.

### Feature Specification:
Overdue tasks gradually fade in opacity over 7 days instead of showing angry red states. Includes bulk archive and individual revival options.

### Technical Requirements:

**Data Model Extension:**
```typescript
interface Task {
  id: string;
  title: string;
  description?: string;
  deadline?: Date;
  completedAt?: Date;
  createdAt: Date;
  overdueStartDate?: Date; // When task first became overdue
  revivedAt?: Date; // If user revived the task
  // ... existing fields
}

// Computed property
function getOpacity(task: Task): number {
  if (!task.deadline || task.completedAt) return 1.0;
  
  const now = new Date();
  const deadlineDate = new Date(task.deadline);
  
  if (now <= deadlineDate) return 1.0; // Not overdue
  
  const overdueStart = task.overdueStartDate || deadlineDate;
  const daysSinceOverdue = Math.floor((now.getTime() - overdueStart.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysSinceOverdue >= 7) return 0.3; // Min opacity
  
  // Linear decay: 1.0 → 0.3 over 7 days (10% per day)
  return 1.0 - (daysSinceOverdue * 0.1);
}
```

**Implementation Steps:**

1. **Opacity Calculation Logic:**
   - Run daily check (on app open) to update overdueStartDate for tasks that just became overdue
   - Apply opacity via component style prop: `opacity: getOpacity(task)`
   - Store overdueStartDate in task object when deadline passes

2. **Visual Treatment:**
   - Task item opacity fades from 1.0 → 0.3 over 7 days
   - NO color changes (no red text, no angry indicators)
   - Deadline text shows days overdue in subtle gray: "3 days ago" (not "3 days overdue")
   - At 0.3 opacity, task is barely visible but still interactive

3. **Archive Functionality:**
   - When ANY tasks reach 7+ days overdue, show "Archive old tasks" button
   - Position: Bottom of task list, full-width, subtle gray background (#F5F5F5)
   - Button text: "Archive 5 overdue tasks" (dynamic count)
   - Tap → Confirmation modal: "Move 5 tasks to archive?" with "Archive" and "Cancel" buttons
   - Archived tasks move to separate archived[] array, not visible in main list
   - Archive accessible via settings/menu: "View Archive" (read-only list)

4. **Revive Functionality:**
   - Swipe action on overdue task (swipe right) reveals "Revive" button
   - Revive action:
     - Resets opacity to 1.0
     - Sets deadline to today (or user can immediately pick new date)
     - Clears overdueStartDate
     - Sets revivedAt timestamp
   - Visual feedback: Quick flash to full opacity with 150ms animation

5. **State Management:**
   - Add overdueStartDate field to task schema
   - On app mount, scan all tasks and set overdueStartDate if deadline passed but field is null
   - Use useMemo to calculate opacity for each task render
   - Persist archived tasks separately: AsyncStorage key 'archived_tasks'

6. **Edge Cases:**
   - If user completes an overdue task before it fully decays, remove from decay tracking
   - If deadline is changed on a decaying task, recalculate opacity from new deadline
   - If task is revived then becomes overdue again, reset decay countdown
   - Handle timezone considerations for deadline comparisons

### Design Constraints:
- NO red colors or angry indicators
- Opacity is ONLY visual cue
- Archive button: Minimal, not prominent (gray background, black text, 12pt)
- Swipe gesture: 120px threshold, 200ms animation reveal
- Confirmation modal: Centered card, 80% width, white background, black text

### Deliverable:
Provide complete implementation with:
- Opacity calculation utility function
- Task list component updates
- Swipe gesture handler
- Archive screen component
- State management for archived tasks
- Migration logic for existing tasks

Test scenarios: Task becomes overdue, decays over time, gets revived, gets archived.