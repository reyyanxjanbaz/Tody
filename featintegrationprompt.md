You have implemented 5 premium features for the minimalistic React Native to-do app. Now integrate them cohesively.

### Integration Requirements:

1. **State Management Coordination:**
   - If using Redux: Create unified store with slices for tasks, inbox, patterns, filters, archived
   - If using Context: Create top-level providers that wrap app
   - Shared types: Create /src/types/task.ts with unified Task interface containing all fields
   - Utils: Create /src/utils/ folder with helpers: decay, patterns, locks, filters, opacity

2. **Task Schema Consolidation:**
```typescript
   // Final unified Task interface
   interface Task {
     // Core fields
     id: string;
     title: string;
     description?: string;
     createdAt: Date;
     completedAt?: Date;
     
     // Scheduling
     deadline?: Date;
     estimatedMinutes?: number;
     actualMinutes?: number;
     startedAt?: Date;
     
     // Organization
     priority: 'high' | 'medium' | 'low';
     energyLevel: 'high' | 'medium' | 'low';
     
     // Hierarchy
     parentId?: string;
     childIds: string[];
     depth: number;
     
     // Decay system
     overdueStartDate?: Date;
     revivedAt?: Date;
     
     // User
     userId: string;
   }
```

3. **UI Component Hierarchy:**
App.tsx
├── AuthStack (Login/Register)
└── MainStack
├── TaskListScreen
│   ├── QuickCaptureButton (FAB)
│   ├── InboxBadge
│   ├── EnergyFilterBar
│   └── TaskList
│       └── TaskItem (applies decay opacity, lock icons, energy typography)
├── ProcessingModeScreen
├── RealityScoreScreen
└── ArchiveScreen
4. **Feature Interaction Matrix:**
   - Quick capture → Processing → Can set energy level during processing
   - Locked parent task → Can still add subtasks → Subtasks inherit parent's energy suggestion
   - Decayed task → If revived → Estimate suggestion appears based on patterns
   - Filtered by energy → Hierarchy still visible → Locked parents still show
   - Reality score → Factors in all completed tasks → Regardless of archive status

5. **Performance Optimization:**
   - Memoize: Task filtering, opacity calculations, lock states
   - Use FlatList with keyExtractor and getItemLayout for task list
   - Debounce: Search queries, pattern matching, filter state persistence
   - Lazy load: Archive screen only fetches archived tasks when opened

6. **Data Persistence Strategy:**
   - AsyncStorage keys:
     - 'tasks' → Main tasks array
     - 'inbox_tasks' → Inbox array
     - 'archived_tasks' → Archived array
     - 'task_patterns' → Pattern learning data
     - 'user_stats' → Reality score data
     - 'energy_filter_preference' → Last selected filter
   - On app launch: Hydrate all from AsyncStorage
   - On app background: Save all to AsyncStorage
   - On task update: Debounced save (500ms) to avoid excessive writes

7. **Navigation Flow:**
   - Main screen: Shows filtered task list + energy filters + inbox badge + FAB
   - Tap inbox badge → Navigate to Processing Mode
   - Tap "Stats" in menu → Navigate to Reality Score
   - Tap "Archive" in menu → Navigate to Archive
   - All screens: Consistent header style, minimal transitions (slide from right, 250ms)

8. **Testing Checklist:**
   - [ ] Quick capture → Process → Task appears in main list
   - [ ] Create subtask → Parent locks → Complete children → Parent unlocks
   - [ ] Task becomes overdue → Decays over 7 days → Archive appears → Revival works
   - [ ] Complete task with estimate → Pattern saves → Similar task shows suggestion
   - [ ] Filter by energy → Correct tasks show → Count updates → Persistence works
   - [ ] All features work together without conflicts
   - [ ] Performance: List scrolls smoothly with 100+ tasks
   - [ ] Persistence: Close app, reopen, state restored

9. **Code Organization:**
/src
/components
- TaskItem.tsx
- QuickCaptureModal.tsx
- EnergyFilterBar.tsx
- SubtaskConnector.tsx
- ArchiveButton.tsx
/screens
- TaskListScreen.tsx
- ProcessingModeScreen.tsx
- RealityScoreScreen.tsx
- ArchiveScreen.tsx
/hooks
- useInbox.ts
- useTaskPatterns.ts
- useDecay.ts
- useLocks.ts
- useEnergyFilter.ts
/utils
- taskHelpers.ts (opacity, lock calculation)
- patternMatcher.ts
- dateHelpers.ts
/types
- task.ts
- inbox.ts
- pattern.ts
/context
- TaskContext.tsx
- AuthContext.tsx
/navigation
- AppNavigator.tsx
### Deliverable:
Provide:
- Complete integrated app with all 5 features working cohesively
- State management setup (Context or Redux)
- Unified types and interfaces
- Navigation configuration
- Performance optimizations applied
- Testing notes for each feature interaction
- Setup instructions for running the app

The app should feel like a unified product, not 5 separate features bolted together.