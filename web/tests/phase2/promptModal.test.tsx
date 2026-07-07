import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PromptModal } from '../../src/ui/PromptModal';

describe('Phase 2.6 — PromptModal', () => {
  it('autofocuses the input shortly after opening', async () => {
    render(
      <PromptModal visible title="Name?" onSubmit={() => {}} onCancel={() => {}} />,
    );
    await waitFor(() => expect(screen.getByRole('textbox')).toHaveFocus(), { timeout: 500 });
  });

  it('Enter submits the current value', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<PromptModal visible title="Name?" onSubmit={onSubmit} onCancel={() => {}} />);
    await waitFor(() => expect(screen.getByRole('textbox')).toHaveFocus());
    await user.type(screen.getByRole('textbox'), 'Groceries{Enter}');
    expect(onSubmit).toHaveBeenCalledWith('Groceries');
  });

  it('Escape cancels', async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<PromptModal visible title="Name?" onSubmit={() => {}} onCancel={onCancel} />);
    await waitFor(() => expect(screen.getByRole('textbox')).toHaveFocus());
    await user.type(screen.getByRole('textbox'), '{Escape}');
    expect(onCancel).toHaveBeenCalled();
  });

  it('Cancel button calls onCancel', async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<PromptModal visible title="Name?" onSubmit={() => {}} onCancel={onCancel} />);
    await user.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('pre-fills defaultValue and uses a custom submitLabel', async () => {
    render(
      <PromptModal
        visible
        title="Rename"
        defaultValue="Old name"
        submitLabel="Rename"
        onSubmit={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByDisplayValue('Old name')).toBeInTheDocument();
    expect(screen.getByText('Rename', { selector: 'button' })).toBeInTheDocument();
  });
});
