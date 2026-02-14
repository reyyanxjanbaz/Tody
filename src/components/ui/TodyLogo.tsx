import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { FontFamily, type ThemeColors } from '../../utils/colors';

type Props = {
  size?: number;
};

/**
 * TodyLogo – renders the calendar-style app logo.
 *
 *  ┌──────────────┐
 *  │   Feb  30    │  ← dark top bar
 *  ├──────────────┤
 *  │    T o       │
 *  │    D y       │  ← main body
 *  └──────────────┘
 *
 * "o" is rendered as a hollow square to match the brand mark.
 */
export function TodyLogo({ size = 56 }: Props) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark, size), [colors, isDark, size]);

  const monthDay = useMemo(() => {
    const now = new Date();
    const month = now.toLocaleString('en-US', { month: 'short' });
    const day = now.getDate();
    return `${month} ${day}`;
  }, []);

  return (
    <View style={styles.container}>
      {/* Top date bar */}
      <View style={styles.topBar}>
        <Text style={styles.dateText}>{monthDay}</Text>
      </View>
      {/* Separator line */}
      <View style={styles.separator} />
      {/* Main body with ToDy text */}
      <View style={styles.body}>
        <View style={styles.row}>
          <Text style={styles.letterT}>T</Text>
          <View style={styles.letterOBox}>
            <View style={styles.letterOInner} />
          </View>
        </View>
        <View style={styles.row}>
          <Text style={styles.letterD}>D</Text>
          <Text style={styles.letterY}>y</Text>
        </View>
      </View>
    </View>
  );
}

function createStyles(c: ThemeColors, isDark: boolean, size: number) {
  const scale = size / 56;
  const bgColor = isDark ? c.text : c.black;
  const fgColor = isDark ? c.black : c.white;

  return StyleSheet.create({
    container: {
      width: size,
      height: size,
      borderRadius: 10 * scale,
      backgroundColor: bgColor,
      overflow: 'hidden',
    },
    topBar: {
      height: size * 0.23,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: bgColor,
    },
    dateText: {
      fontFamily: FontFamily,
      fontSize: 9 * scale,
      fontWeight: '700',
      fontStyle: 'italic',
      color: fgColor,
      letterSpacing: 0.3,
    },
    separator: {
      height: StyleSheet.hairlineWidth * 2,
      backgroundColor: fgColor,
      opacity: 0.5,
    },
    body: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingBottom: 2 * scale,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    letterT: {
      fontFamily: FontFamily,
      fontSize: 18 * scale,
      fontWeight: '700',
      color: fgColor,
      lineHeight: 21 * scale,
    },
    letterOBox: {
      width: 11.5 * scale,
      height: 11.5 * scale,
      borderWidth: 2.2 * scale,
      borderColor: fgColor,
      marginLeft: -0.5 * scale,
      marginTop: 1.5 * scale,
      justifyContent: 'center',
      alignItems: 'center',
    },
    letterOInner: {
      width: 0,
      height: 0,
    },
    letterD: {
      fontFamily: FontFamily,
      fontSize: 18 * scale,
      fontWeight: '700',
      color: fgColor,
      lineHeight: 21 * scale,
    },
    letterY: {
      fontFamily: FontFamily,
      fontSize: 18 * scale,
      fontWeight: '400',
      color: fgColor,
      lineHeight: 21 * scale,
      marginLeft: 0.5 * scale,
    },
  });
}
