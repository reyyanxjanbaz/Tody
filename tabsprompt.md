# COMPONENT ENHANCEMENT: ENERGY FILTER FOR HOME SCREEN

You are enhancing the Home Screen component of an existing Todo List application by replacing the current task categorization with a tab-based Energy Filter system.

---

## WORKFLOW

### PHASE 1: TARGETED COMPONENT ANALYSIS

Analyze only the Home Screen component and related task functionality:

#### 1.1 Locate Home Screen Component
- Find the main home/dashboard page file
- Identify the task list component
- Locate task creation/edit components
- Find existing category/filtering logic (if any)

#### 1.2 Understand Current Task Structure
- Read task type/interface definitions
- Identify current task fields (id, title, description, completed, dueDate, category, priority, etc.)
- Understand how tasks are stored and fetched
- Check if categories currently exist in the data model

#### 1.3 Examine Component Patterns
- Identify tab/navigation component patterns in the codebase
- Find modal/dialog components for forms
- Locate button and icon usage patterns
- Check drag-and-drop library (if used elsewhere)
- Understand scrollable container patterns

#### 1.4 Review Styling Approach
- Note tab styling patterns (if tabs exist elsewhere)
- Identify active/inactive state styles
- Check horizontal scroll implementation patterns
- Find filter/sort UI patterns
- Note button group or action button styling

---

### PHASE 2: IMPLEMENTATION PLAN

Based on analysis, plan:

**Components to Create/Modify:**
1. EnergyFilter component (tab navigation)
2. TaskList component (modify to accept category filter)
3. AddCategoryModal component
4. ManageCategoriesModal component
5. TaskForm component (modify to include category selector)
6. FilterButton component (for sorting within tabs)

**Data Model Changes:**
- Add/verify `category` field on tasks
- Create category type/interface
- Set up default categories in state/database

**State Management:**
- Active tab state
- Categories list state
- Filter/sort state per tab
- Category CRUD operations

---

### PHASE 3: BUILD THE FEATURE

Follow discovered patterns exactly and implement:

#### 3.1 Default Categories Setup
Create initial categories structure:
- Overview (id: 'overview', not assignable, not removable, always first)
- Work (id: 'work', assignable, editable, removable)
- Personal (id: 'personal', assignable, editable, removable)
- Health (id: 'health', assignable, editable, removable)

#### 3.2 Energy Filter Component
Build tab navigation with:
- Horizontal scrollable tab list
- Show first 4 tabs initially
- Smooth scroll for overflow tabs
- Active tab highlighting
- Add button (positioned right of tabs)
- Manage button (positioned right of tabs)
- Default to Overview tab on load

#### 3.3 Category Management
Implement:
- Add new category modal (name input, create button)
- Manage categories modal with:
  - Rename functionality
  - Drag-to-reorder (using existing drag library or implement)
  - Delete category (with confirmation)
  - Disable delete/edit for Overview
- Append new categories after default tabs

#### 3.4 Task Assignment Logic
Modify task creation/edit forms:
- Add category selector dropdown/radio
- Show only assignable categories (exclude Overview)
- Make category selection required
- Update task on category change
- Reflect changes immediately in UI

#### 3.5 Task Filtering by Tab
Implement tab filtering:
- Overview: show all tasks for selected day
- Other tabs: show only tasks matching that category
- Filter tasks based on active tab selection
- Update task list when tab changes

#### 3.6 Sort/Filter within Tabs
Add filter button to each tab's task list:
- Position in task list header area
- Open sort/filter dropdown or modal
- Sorting options:
  - Deadline (ascending/descending)
  - Priority (high to low / low to high)
  - Creation date
  - Completion status
- Apply sort only to current tab's tasks
- Reset filter on tab change (or persist if that's the pattern)

#### 3.7 Styling Requirements
Match existing app patterns for:
- Tab container and individual tab styling
- Active/inactive tab states
- Horizontal scroll container
- Modal/dialog styling
- Button groups and icon buttons
- Dropdown/select components
- Drag handles for reordering

---

## CRITICAL RULES

- **ANALYZE FIRST**: Read Home Screen and task-related components before coding
- **MATCH PATTERNS**: Use existing tab, modal, and form patterns
- **REUSE COMPONENTS**: Use existing Button, Modal, Input, Select components
- **FOLLOW CONVENTIONS**: Match file structure, naming, and styling exactly
- **NO BREAKING CHANGES**: Ensure existing tasks and functionality remain intact

---

## IMPLEMENTATION CHECKLIST

- [ ] Default categories initialized correctly
- [ ] Overview tab displays all tasks
- [ ] Category tabs filter tasks correctly
- [ ] Overview is not selectable in task forms
- [ ] Overview cannot be edited or deleted
- [ ] New categories can be created
- [ ] Categories can be renamed
- [ ] Categories can be reordered
- [ ] Categories can be deleted (with constraints)
- [ ] Tab scrolling works smoothly
- [ ] Filter button appears in each tab
- [ ] Sorting works within each tab
- [ ] Task assignment respects category rules
- [ ] UI matches existing design system
- [ ] Responsive on mobile/tablet/desktop

---

## DELIVERABLE

Implement the Energy Filter system that:
1. Replaces current categorization with tab-based filtering
2. Provides default categories with proper rules
3. Allows category management (add, edit, reorder, delete)
4. Filters tasks by selected category/tab
5. Supports sorting within each category
6. Integrates seamlessly with existing home screen

The implementation must look and feel native to the existing application.