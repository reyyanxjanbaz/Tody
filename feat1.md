You are implementing the "Rapid Capture + Processing Ritual" feature for a minimalistic React Native to-do app built with TypeScript.

### Feature Specification:
A two-phase task creation system: (1) Instant capture with zero friction, (2) Dedicated processing mode for organizing captured items.

### Technical Requirements:

**Data Model:**
```typescript
interface InboxTask {
  id: string;
  rawText: string;
  capturedAt: Date;
  isProcessing?: boolean;
}

interface ProcessedTask extends InboxTask {
  title: string;
  description?: string;
  deadline?: Date;
  priority: 'high' | 'medium' | 'low';
  energyLevel: 'high' | 'medium' | 'low';
  processedAt: Date;
}
```

**Implementation Steps:**

1. **Quick Capture Interface:**
   - Floating action button (FAB) in bottom-right: 56x56pt black circle, white "+" icon
   - Tap opens modal overlay with single TextInput
   - TextInput: Full-width, minimal border (1px #E0E0E0 bottom only), placeholder "What's on your mind?"
   - Enter key submits → saves to InboxTask[] → closes modal
   - 120ms fade animation in/out
   - Auto-focus on open, blur on submit

2. **Inbox Badge:**
   - On main screen tab/header: Small badge with count of InboxTask[]
   - Position: Top-right of tasks list header
   - Style: 20x20pt circle, black background, white text, system font 12pt medium
   - Only show if count > 0

3. **Processing Mode Screen:**
   - Access: Tap inbox badge or dedicated "Process Inbox" button
   - Layout: Full-screen, single task centered (60% width max)
   - Shows: rawText in large font (20pt), capturedAt timestamp below in gray
   - Action buttons (bottom sheet style):
     - "Make Task" → Expands to show full task form (title pre-filled with rawText, description, deadline picker, priority selector, energy level)
     - "Quick Complete" → Immediately marks as completed, removes from inbox
     - "Delete" → Removes from inbox
     - "Next" → Saves current state, moves to next item
   - Shows progress: "3 of 7" at top
   - Swipe left/right for next/previous item

4. **State Management:**
   - Use React Context or Redux slice for InboxTasks
   - Persist to AsyncStorage with key 'inbox_tasks'
   - When task fully processed, move from InboxTask[] to ProcessedTask[] (main tasks array)

5. **Edge Cases:**
   - If inbox empty, hide badge and show empty state in processing mode
   - If user closes processing mode mid-task, save draft state
   - If quick capture input is empty, shake TextInput, don't submit
   - Max 100 inbox items (show warning at 90)

### Design Constraints:
- NO colors except black/white/grays
- NO rounded corners beyond 4px
- NO shadows except 1px hairline separators
- Button style: Text only, black on white, 44pt touch target
- All animations: 120-200ms, ease-out

### Deliverable:
Provide complete implementation with:
- React Native components (TypeScript)
- Custom hooks if needed (useInbox)
- State management setup
- Integration instructions for existing app structure

Test all interactions: capture, processing flow, edge cases.