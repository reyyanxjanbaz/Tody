import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { Icon } from '../../src/ui/Icon';
import { ICONS } from '../../src/ui/iconRegistry';

describe('Phase 2.1 — Icon + iconRegistry', () => {
  it('has at least 238 registered icons, all valid function components', () => {
    const names = Object.keys(ICONS);
    expect(names.length).toBeGreaterThanOrEqual(238);
    for (const name of names) {
      expect(typeof ICONS[name]).toBe('function');
    }
  });

  it.each([
    'chevron-back', 'checkmark', 'flag-outline', 'flash', 'trash-outline', 'add', 'search-outline',
  ])('renders a known critical icon name: %s', (name) => {
    const { container } = render(<Icon name={name} />);
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('renders an <svg> sized by the size prop', () => {
    const { container } = render(<Icon name="add" size={32} />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
  });

  it('unknown icon names degrade to an empty sized box and warn once (no layout jump)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { container } = render(<Icon name="totally-made-up-icon" size={24} />);
    const box = container.firstElementChild as HTMLElement;
    expect(box.tagName).toBe('SPAN');
    expect(box.style.width).toBe('24px');
    expect(box.style.height).toBe('24px');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('totally-made-up-icon'));
    warnSpy.mockRestore();
  });

  it('rendered icons are hidden from assistive tech (decorative, aria-hidden)', () => {
    const { container } = render(<Icon name="checkmark" />);
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });
});
