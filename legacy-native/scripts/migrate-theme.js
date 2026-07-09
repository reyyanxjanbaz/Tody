#!/usr/bin/env node
/**
 * Automated theme migration script.
 * Transforms all src/ files from static Colors imports to dynamic useTheme() + createStyles.
 * Also adds FontFamily to all text styles.
 */

const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src');

// Files to skip (already transformed or special)
const SKIP_FILES = new Set([
  'src/components/TaskItem.tsx', // Already done manually
  'src/utils/colors.ts',         // Infrastructure file
  'src/context/ThemeContext.tsx',  // Infrastructure file
  'src/types/index.ts',           // No UI
  'src/utils/decay.ts',
  'src/utils/id.ts',
  'src/utils/haptics.ts',
  'src/utils/timeTracking.ts',
  'src/utils/statsCalculation.ts',
  'src/utils/dependencyChains.ts',
  'src/utils/patternLearning.ts',
  'src/utils/storage.ts',
  'src/utils/swipeMemory.ts',
  'src/utils/dateUtils.ts',
  'src/utils/taskIntelligence.ts',
  'src/utils/taskParser.ts',
  'src/utils/animations.ts',
  'src/utils/profileStats.ts',
  'src/components/ui/index.ts',
]);

// Collect all .tsx/.ts files
function collectFiles(dir, base = '') {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = path.join(base, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(path.join(dir, entry.name), rel));
    } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
      files.push(rel);
    }
  }
  return files;
}

function transformFile(relPath, fullPath) {
  let code = fs.readFileSync(fullPath, 'utf-8');
  const original = code;

  // Skip files that don't import Colors
  if (!code.includes("from '../utils/colors'") && !code.includes("from '../../utils/colors'")) {
    return false;
  }

  const colorImportPath = code.includes("from '../../utils/colors'") ? '../../utils/colors' : '../utils/colors';
  const themeImportPath = colorImportPath.replace('/utils/colors', '/context/ThemeContext');

  // 1. Transform the import line
  // Match: import { Colors, Spacing, Typography, ...} from '../utils/colors';
  const importRegex = new RegExp(`import\\s*\\{([^}]+)\\}\\s*from\\s*'${colorImportPath.replace(/\//g, '\\/')}'`);
  const importMatch = code.match(importRegex);
  if (!importMatch) return false;

  const importedNames = importMatch[1].split(',').map(s => s.trim()).filter(Boolean);
  
  // Check what we need
  const usesColors = importedNames.includes('Colors') || code.includes('Colors.');
  const usesShadows = importedNames.includes('Shadows') || code.includes('Shadows.');
  
  // Build new import - remove Colors and Shadows from the named import, add FontFamily and ThemeColors
  const newNamedImports = importedNames.filter(n => n !== 'Colors' && n !== 'Shadows');
  if (!newNamedImports.includes('FontFamily')) newNamedImports.push('FontFamily');
  if (!newNamedImports.includes('ThemeColors')) newNamedImports.push('type ThemeColors');
  
  // Also check if Shadows is used directly (not just ...Shadows.xxx in styles)
  const hasShadowsInStyles = code.includes('Shadows.');
  
  // Also need ThemeShadows if shadows used
  if (hasShadowsInStyles && !newNamedImports.includes('ThemeShadows')) {
    newNamedImports.push('type ThemeShadows');
  }

  const newImportLine = `import { ${newNamedImports.join(', ')} } from '${colorImportPath}';`;
  code = code.replace(importRegex, newImportLine);

  // 2. Add useTheme import (if not already present)
  if (!code.includes('useTheme')) {
    // Insert after the colors import
    code = code.replace(
      newImportLine,
      `${newImportLine}\nimport { useTheme } from '${themeImportPath}';`
    );
  }

  // 3. Find the component function and add useTheme + useMemo for styles
  // Look for the export function or const component
  const funcPatterns = [
    /export\s+function\s+(\w+)\s*\(/,
    /export\s+const\s+(\w+)\s*=\s*memo\s*\(\s*function\s+\w+\s*\(/,
    /const\s+(\w+)\s*=\s*memo\s*\(\s*function\s+\w+\s*\(/,
    /function\s+(\w+)\s*\(/,
  ];
  
  let componentName = null;
  for (const pat of funcPatterns) {
    const m = code.match(pat);
    if (m) { componentName = m[1]; break; }
  }

  // 4. Add useTheme hook call at the beginning of the component
  // Find the first line after the component function opens with const/let or return
  // Strategy: find "const insets =" or the first "const " or "return (" inside the component
  
  // For memo-wrapped components, look for pattern after the opening
  const hookLine = `  const { colors, shadows, isDark } = useTheme();`;
  
  // Check if there's already a useTheme call
  if (!code.includes('useTheme()')) {
    // Find patterns like "const insets", "const {", "const [" etc. inside the component
    // Insert before the first such line
    const componentBodyPatterns = [
      /(\n\s+const\s+insets)/,
      /(\n\s+const\s+\{[^}]+\}\s*=\s*useAuth)/,
      /(\n\s+const\s+\[)/,
      /(\n\s+const\s+\{)/,
    ];
    
    let inserted = false;
    for (const pat of componentBodyPatterns) {
      const m = code.match(pat);
      if (m) {
        code = code.replace(m[1], `\n${hookLine}${m[1]}`);
        inserted = true;
        break;
      }
    }
    
    if (!inserted) {
      // Fallback: insert after function opening brace
      // This is a rough heuristic
      console.log(`  ⚠ Could not auto-insert useTheme hook in ${relPath}`);
    }
  }

  // 5. Convert StyleSheet.create to createStyles factory
  // Match: const styles = StyleSheet.create({...});
  const stylesMatch = code.match(/\nconst\s+styles\s*=\s*StyleSheet\.create\(\{/);
  if (stylesMatch) {
    code = code.replace(
      'const styles = StyleSheet.create({',
      'const createStyles = (c: ThemeColors) => StyleSheet.create({'
    );
    
    // Add styles = useMemo(...) after useTheme hook
    if (code.includes(hookLine) && !code.includes('createStyles(colors)')) {
      code = code.replace(
        hookLine,
        `${hookLine}\n  const styles = React.useMemo(() => createStyles(colors), [colors]);`
      );
    }
    
    // In the createStyles block, replace Colors.xxx with c.xxx
    // Find the createStyles block
    const createStylesStart = code.indexOf('const createStyles = (c: ThemeColors) => StyleSheet.create({');
    if (createStylesStart !== -1) {
      // Replace within styles block only
      const beforeStyles = code.substring(0, createStylesStart);
      let stylesBlock = code.substring(createStylesStart);
      
      // Replace Colors.xxx with c.xxx in styles
      stylesBlock = stylesBlock.replace(/Colors\./g, 'c.');
      
      // Replace Shadows.xxx with appropriate
      // We'll leave Shadows as-is in the factory since shadows come from the hook
      // Actually, let's make the factory accept shadows too if needed
      if (stylesBlock.includes('Shadows.')) {
        // Don't replace Shadows in createStyles - instead we'll handle it differently
        // For now, replace spread ...Shadows.xxx with ...c.__shadows_xxx (we'll fix this)
        // Actually simplest: just leave Shadows as-is since it's imported
        // But we want dark mode shadows... Let me think
        // Simplest approach: shadows are passed through the useTheme hook, 
        // and in the styles function we skip Shadows (keep light shadows as default)
        // Then override via the hook in JSX where needed
        // For the initial migration, keep Shadows as-is
      }
      
      // Replace hardcoded colors that should be theme-aware
      stylesBlock = stylesBlock.replace(/backgroundColor:\s*'#F2F2F7'/g, "backgroundColor: c.gray50");
      stylesBlock = stylesBlock.replace(/backgroundColor:\s*'#F5F5F5'/g, "backgroundColor: c.surface");
      stylesBlock = stylesBlock.replace(/backgroundColor:\s*'#FFFFFF'/g, "backgroundColor: c.background");
      stylesBlock = stylesBlock.replace(/backgroundColor:\s*'#000000'/g, "backgroundColor: c.text");
      stylesBlock = stylesBlock.replace(/borderColor:\s*'rgba\(0,0,0,0\.10\)'/g, "borderColor: c.border");
      stylesBlock = stylesBlock.replace(/borderColor:\s*'rgba\(0,0,0,0\.12\)'/g, "borderColor: c.border");
      stylesBlock = stylesBlock.replace(/borderColor:\s*'rgba\(0,0,0,0\.06\)'/g, "borderColor: c.borderLight");
      stylesBlock = stylesBlock.replace(/color:\s*'#000000'/g, "color: c.text");
      stylesBlock = stylesBlock.replace(/color:\s*'#9E9E9E'/g, "color: c.textTertiary");
      
      // Add fontFamily to text styles that have fontSize but no fontFamily
      // Look for properties with fontSize that don't already have fontFamily
      stylesBlock = stylesBlock.replace(
        /(fontSize:\s*\d+[^}]*?)(,?\s*\})/g,
        (match, before, end) => {
          if (before.includes('fontFamily')) return match;
          // Only add to text styles (those with fontSize)
          return `${before},\n    fontFamily: FontFamily${end}`;
        }
      );
      
      code = beforeStyles + stylesBlock;
    }
  }

  // 6. Replace Colors.xxx with colors.xxx in JSX (outside styles block)
  // Only in the JSX part (before createStyles)
  const createStylesIdx = code.indexOf('const createStyles');
  if (createStylesIdx !== -1) {
    let jsxPart = code.substring(0, createStylesIdx);
    jsxPart = jsxPart.replace(/Colors\./g, 'colors.');
    code = jsxPart + code.substring(createStylesIdx);
  } else {
    // No createStyles, replace all Colors. with colors.
    code = code.replace(/Colors\./g, 'colors.');
  }

  // 7. Handle Shadows in styles - replace Shadows. with shadows. in JSX
  // In the JSX portion
  if (createStylesIdx !== -1) {
    let jsxPart = code.substring(0, code.indexOf('const createStyles'));
    if (jsxPart.includes('Shadows.')) {
      jsxPart = jsxPart.replace(/Shadows\./g, 'shadows.');
    }
    code = jsxPart + code.substring(code.indexOf('const createStyles'));
  }

  // 8. Ensure useMemo is imported from React (needed for styles)
  if (code.includes('React.useMemo') && !code.includes("'react'")) {
    // react should always be imported, but just check
  }

  if (code === original) return false;
  
  fs.writeFileSync(fullPath, code, 'utf-8');
  return true;
}

// Main
const allFiles = collectFiles(SRC, 'src');
let transformed = 0;
let skipped = 0;

for (const relPath of allFiles) {
  if (SKIP_FILES.has(relPath)) {
    skipped++;
    continue;
  }
  
  const fullPath = path.join(__dirname, '..', relPath);
  try {
    const did = transformFile(relPath, fullPath);
    if (did) {
      console.log(`✓ ${relPath}`);
      transformed++;
    }
  } catch (err) {
    console.error(`✗ ${relPath}: ${err.message}`);
  }
}

console.log(`\nDone: ${transformed} transformed, ${skipped} skipped`);
