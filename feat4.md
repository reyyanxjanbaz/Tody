You are implementing the "Dependency Chains" feature for a minimalistic React Native to-do app built with TypeScript.

### Feature Specification:
Allow tasks to have subtasks (max 3 levels deep). Parent tasks are locked until all children are completed, enforcing honest progress without complex dependency mapping.

### Technical Requirements:

**Data Model:**
```typescript
interface Task {
  id: string;
  title: string;
  parentId?: string; // null for root tasks
  childIds: string[]; // Array of child task IDs
  depth: number; // 0 = root, 1 = first level subtask, 2 = second level, 3 = max
  isLocked: boolean; // Computed: true if has incomplete children
  completedAt?: Date;
  // ... existing fields
}

// Computed helper
function isTaskLocked(task: Task, allTasks: Task[]): boolean {
  if (task.childIds.length === 0) return false;
  
  const children = allTasks.filter(t => task.childIds.includes(t.id));
  return children.some(child => !child.completedAt);
}

// Get all descendants (recursive)
function getAllDescendants(taskId: string, allTasks: Task[]): Task[] {
  const task = allTasks.find(t => t.id === taskId);
  if (!task || task.childIds.length === 0) return [];
  
  const children = allTasks.filter(t => task.childIds.includes(t.id));
  const descendants = [...children];
  
  children.forEach(child => {
    descendants.push(...getAllDescendants(child.id, allTasks));
  });
  
  return descendants;
}
```

**Implementation Steps:**

1. **Adding Subtasks:**
   - Long-press (500ms) on any task → Haptic feedback → Context menu appears
   - Context menu options: "Add subtask", "Delete task", "Cancel"
   - Menu style: White card, centered, 200pt width, black text buttons, 1px separator
   - Selecting "Add subtask":
     - Check current depth: If depth ≥ 3, show toast: "Max 3 levels of subtasks"
     - If depth < 3: Open task creation form with parentId pre-set
     - New subtask: depth = parent.depth + 1
     - Add subtask.id to parent.childIds array
   - Alternative quick method: Swipe right on task → Shows "Add subtask" button

2. **Visual Hierarchy:**
   - Indentation: depth * 16px left margin (max 48px for depth 3)
   - Connector line: Thin vertical gray line (#E0E0E0, 1px) from parent to last child
   - Horizontal tick: 8px horizontal line connecting to child task
   - NO nested collapsing/expanding (always show all tasks in flat list)
   - Parent task font: If has children, make title slightly bolder (medium weight vs regular)

3. **Lock Mechanism:**
   - Locked parent task: Show small lock icon (12x12pt) left of checkbox
   - Lock icon: Simple line art, black, minimal
   - Checkbox: Disabled style (gray border instead of black) when locked
   - Tap on locked checkbox → Shake animation (5px left-right, 3 times, 200ms)
   - Simultaneously: Highlight incomplete children (200ms opacity pulse to 0.6)
   - NO modal/alert explaining why locked (visual feedback sufficient)

4. **Completion Flow:**
   - When user completes a child task:
     - Check parent's other children
     - If all siblings complete: Auto-unlock parent (remove lock icon with 150ms fade)
     - Optional: Show subtle success indicator on parent (brief green dot, fades after 1s)
   - When all children complete, parent can now be checked off normally

5. **Moving/Reorganizing:**
   - Long-press + drag to reorder tasks (react-native-draggable-flatlist)
   - Constraint: Can only drag within same depth level (can't make root task a child by dragging)
   - To change parent: Long-press menu → "Move to..." → Shows list of valid parent tasks
   - Valid parents: Any task at depth < 3, excluding self and descendants (prevent circular deps)

6. **Deletion Logic:**
   - Delete parent with children: Show confirmation: "Delete task and 3 subtasks?" 
   - On confirm: Delete parent and ALL descendants recursively
   - Delete child: Only deletes child, parent's childIds array updates
   - If parent has no more children after deletion, remove lock

7. **State Management:**
   - Add parentId, childIds, depth fields to task schema
   - Create utility functions: isTaskLocked, getAllDescendants, getChildren, getParent
   - When rendering list, use useMemo to calculate lock states for all tasks
   - On task completion/creation/deletion, recalculate affected task locks

8. **Edge Cases:**
   - Max depth reached: Prevent subtask creation, show error
   - Circular dependency prevention: Before setting parent, verify it's not a descendant
   - Orphaned tasks: If parent deleted, children move to depth 0 (become root tasks)
   - Completing parent before children: Shake animation + highlight incomplete children
   - Filter/sort: Maintain hierarchy (show children immediately after parent)

### Design Constraints:
- Connector lines: 1px, #E0E0E0, subtle
- Lock icon: Line art, not filled, 12x12pt
- Indentation: 16px per level, clean alignment
- Long-press menu: White card, subtle 2px shadow (exception to no-shadow rule)
- Shake animation: 5px amplitude, 200ms duration
- NO colors for locked state (only gray + icon)

### Deliverable:
Provide complete implementation with:
- Long-press gesture handler
- Subtask creation flow
- Lock/unlock logic with utilities
- Visual hierarchy rendering
- Deletion with cascade
- Move/reorganize functionality
- State management updates

Test scenarios: Create 3-level hierarchy, try to complete parent first (should shake), complete children (parent unlocks), delete parent (cascades), try to exceed max depth.