#!/usr/bin/env node
/**
 * Inserts useTheme() hook + useMemo styles into components that were missed
 * by the initial migration script.
 */
const fs = require('fs');
const path = require('path');
const BASE = '/Users/reyyan/Desktop/projects/Tody';

// Files that have createStyles but are missing useTheme() call
// Format: [relPath, lineNumberOfFirstBodyLine]
const WITH_CREATE_STYLES = [
  ['src/components/Button.tsx', 49],
  ['src/components/CalendarStrip.tsx', 153],
  ['src/components/DeadlineSnapper.tsx', 37],
  ['src/components/EmptyState.tsx', 35],
  ['src/components/EnergyFilter.tsx', 35],
  ['src/components/ManageCategoriesModal.tsx', 37],
  ['src/components/SectionHeader.tsx', 17],
  ['src/components/SmartKeyboardToolbar.tsx', 58],
  ['src/components/SortDropdown.tsx', 45],
  ['src/components/TaskContextMenu.tsx', 28],
  ['src/components/TaskPreviewOverlay.tsx', 58],
  ['src/components/ZeroStateOnboarding.tsx', 92],
  ['src/components/profile/ProfileHeader.tsx', 31],
  ['src/components/profile/StatsSection.tsx', 29],
  ['src/components/profile/XPSection.tsx', 27],
  ['src/components/ui/CapsuleButton.tsx', 38],
];

const hookLines = `  const { colors, shadows, isDark } = useTheme();\n  const styles = React.useMemo(() => createStyles(colors), [colors]);\n`;

for (const [rel, lineNum] of WITH_CREATE_STYLES) {
  const filePath = path.join(BASE, rel);
  const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
  
  // Check if useTheme() is already called
  if (lines.some(l => l.includes('useTheme()'))) {
    console.log(`⏭ ${rel} — already has useTheme()`);
    continue;
  }
  
  // Insert before the target line (0-indexed = lineNum - 1)
  const insertIdx = lineNum - 1;
  lines.splice(insertIdx, 0, ...hookLines.split('\n'));
  
  // Also ensure React is imported (for React.useMemo)
  // Check if React is imported
  const hasReactImport = lines.some(l => /^import\s+React/.test(l));
  if (!hasReactImport) {
    // Add React import at top
    lines.splice(0, 0, "import React from 'react';");
  }
  
  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
  console.log(`✓ ${rel}`);
}

// Special handling: EnergySelector.tsx (no createStyles, uses static selectorStyles)
{
  const filePath = path.join(BASE, 'src/components/EnergySelector.tsx');
  let code = fs.readFileSync(filePath, 'utf-8');
  if (!code.includes('useTheme()')) {
    // This component is small. Add the hook and convert selectorStyles to createStyles.
    // First, check for the component start
    code = code.replace(
      /export\s+function\s+EnergySelector\(\{[^}]+\}\)\s*\{/,
      match => `${match}\n  const { colors, shadows, isDark } = useTheme();`
    );
    fs.writeFileSync(filePath, code, 'utf-8');
    console.log('✓ src/components/EnergySelector.tsx');
  }
}

// Special handling: AnimatedCheckbox.tsx (no createStyles, uses inline animated styles)
{
  const filePath = path.join(BASE, 'src/components/ui/AnimatedCheckbox.tsx');
  let code = fs.readFileSync(filePath, 'utf-8');
  if (!code.includes('useTheme()')) {
    code = code.replace(
      /export\s+(?:const|function)\s+AnimatedCheckbox\s*=\s*memo\(\s*function\s+\w+\s*\([^)]*\)\s*\{/,
      match => `${match}\n  const { colors, shadows, isDark } = useTheme();`
    );
    // If the above didn't match, try a simpler pattern
    if (!code.includes('useTheme()')) {
      code = code.replace(
        /function\s+AnimatedCheckbox\s*\([^)]*\)\s*\{/,
        match => `${match}\n  const { colors, shadows, isDark } = useTheme();`
      );
    }
    fs.writeFileSync(filePath, code, 'utf-8');
    console.log('✓ src/components/ui/AnimatedCheckbox.tsx');
  }
}

// Special handling: TodayLine.tsx
{
  const filePath = path.join(BASE, 'src/components/TodayLine.tsx');
  let code = fs.readFileSync(filePath, 'utf-8');
  
  // Add useTheme import if not present
  if (!code.includes('useTheme')) {
    code = code.replace(
      /from\s*'\.\.\/utils\/colors'/,
      match => `${match};\nimport { useTheme } from '../context/ThemeContext'`
    );
    // Fix double semicolon
    code = code.replace("';;", "';");
  }

  // Add hook call
  if (!code.includes('useTheme()')) {
    code = code.replace(
      /export\s+(?:function|const)\s+TodayLine/,
      match => {
        // Find the function body opening
        return match;
      }
    );
    // Simpler: find the component function opening
    const funcMatch = code.match(/(function\s+TodayLine\s*\([^)]*\)\s*\{)/);
    if (funcMatch) {
      code = code.replace(funcMatch[1], `${funcMatch[1]}\n  const { colors } = useTheme();`);
    }
  }
  
  // Replace hardcoded colors in styles
  code = code.replace(/#FFFFFF/g, (m, offset) => {
    // Quick check if we're in a style
    return '#FFFFFF'; // We'll handle this separately
  });
  
  fs.writeFileSync(filePath, code, 'utf-8');
  console.log('✓ src/components/TodayLine.tsx');
}

console.log('\nDone!');
