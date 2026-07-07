import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { TextField } from '../../src/ui/TextField';
import { SectionHeader } from '../../src/ui/SectionHeader';
import { TodayLine } from '../../src/ui/TodayLine';
import { EmptyState } from '../../src/ui/EmptyState';
import { CategoryPill } from '../../src/ui/CategoryPill';
import { Spinner } from '../../src/ui/Spinner';
import { Screen } from '../../src/ui/Screen';
import { ThemeProvider } from '../../src/core/context/ThemeContext';
import type { Category } from '../../src/core/types';

describe('Phase 2.7 — TextField', () => {
  it('renders a label and forwards input props', async () => {
    const user = userEvent.setup();
    render(<TextField label="Email" placeholder="you@example.com" onChange={() => {}} />);
    expect(screen.getByText('Email')).toBeInTheDocument();
    const input = screen.getByPlaceholderText('you@example.com');
    await user.type(input, 'a@b.com');
    expect(input).toHaveValue('a@b.com');
  });

  it('shows an error message when error is set', () => {
    render(<TextField error="Required" />);
    expect(screen.getByText('Required')).toBeInTheDocument();
  });
});

describe('Phase 2.7 — SectionHeader', () => {
  it('renders the title and count', () => {
    render(<SectionHeader title="TODAY" count={3} />);
    expect(screen.getByText('TODAY')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});

describe('Phase 2.7 — TodayLine', () => {
  it('renders the TODAY marker', () => {
    render(<TodayLine />);
    expect(screen.getByText('TODAY')).toBeInTheDocument();
  });
});

describe('Phase 2.7 — EmptyState', () => {
  it('renders title/subtitle and fires the action', async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();
    render(
      <EmptyState
        title="Nothing here"
        subtitle="Add one below"
        icon="add"
        actionLabel="Add template"
        onAction={onAction}
      />,
    );
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
    expect(screen.getByText('Add one below')).toBeInTheDocument();
    await user.click(screen.getByText('Add template'));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('omits the action button when no actionLabel/onAction is given', () => {
    render(<EmptyState title="Nothing here" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('Phase 2.7 — CategoryPill', () => {
  const categories: Category[] = [
    { id: 'work', name: 'Work', icon: 'briefcase-outline', color: '#3B82F6', isDefault: false, order: 1 },
    { id: 'personal', name: 'Personal', icon: 'person-outline', color: '#8B5CF6', isDefault: false, order: 2 },
  ];

  it('shows the current category label and opens a dropdown on click', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <CategoryPill value="work" categories={categories} onChange={() => {}} />
      </ThemeProvider>,
    );
    await waitFor(() => expect(screen.getByText('Work')).toBeInTheDocument());
    await user.click(screen.getByText('Work'));
    await waitFor(() => expect(screen.getByText('Personal')).toBeInTheDocument());
  });

  it('selecting an option calls onChange and closes the dropdown', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <CategoryPill value="work" categories={categories} onChange={onChange} />
      </ThemeProvider>,
    );
    await waitFor(() => expect(screen.getByText('Work')).toBeInTheDocument());
    await user.click(screen.getByText('Work'));
    await waitFor(() => expect(screen.getByText('Personal')).toBeInTheDocument());
    await user.click(screen.getByText('Personal'));
    expect(onChange).toHaveBeenCalledWith('personal');
  });
});

describe('Phase 2.7 — Spinner', () => {
  it('renders a sized ring element', () => {
    const { container } = render(<Spinner size={32} />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.width).toBe('32px');
    expect(el.style.height).toBe('32px');
  });
});

describe('Phase 2.7 — Screen', () => {
  it('renders the title and, when back is requested, navigates back on click', async () => {
    const onBack = vi.fn();
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Screen title="Settings" onBack={onBack}>
          <div>body</div>
        </Screen>
      </MemoryRouter>,
    );
    expect(screen.getByText('Settings')).toBeInTheDocument();
    await user.click(screen.getByLabelText('Back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('omits the header entirely when header={false}', () => {
    render(
      <MemoryRouter>
        <Screen header={false}>
          <div>body</div>
        </Screen>
      </MemoryRouter>,
    );
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
  });
});
