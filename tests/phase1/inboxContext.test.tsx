import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { InboxProvider, useInbox } from '../../src/core/context/InboxContext';
import { AuthedShell } from './testUtils';
import { getInboxTasks } from '../../src/core/utils/storage';

function wrapper({ children }: { children: ReactNode }) {
  return (
    <AuthedShell>
      <InboxProvider>{children}</InboxProvider>
    </AuthedShell>
  );
}

async function setupLoaded() {
  const { result } = renderHook(() => useInbox(), { wrapper });
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  return result;
}

describe('Phase 1.7 — InboxContext', () => {
  beforeEach(() => localStorage.clear());

  it('captureTask adds an item to the front of the inbox', async () => {
    const result = await setupLoaded();
    act(() => {
      result.current.captureTask('call the plumber');
    });
    expect(result.current.inboxTasks[0].rawText).toBe('call the plumber');
    expect(result.current.inboxCount).toBe(1);
  });

  it('removeInboxTask (aka deleteInboxTask) removes an item', async () => {
    const result = await setupLoaded();
    let id = '';
    act(() => { id = result.current.captureTask('todo')!.id; });
    act(() => { result.current.removeInboxTask(id); });
    expect(result.current.inboxTasks.find(t => t.id === id)).toBeUndefined();
    expect(result.current.deleteInboxTask).toBe(result.current.removeInboxTask);
  });

  it('getInboxTask looks up a captured item by id', async () => {
    const result = await setupLoaded();
    let id = '';
    act(() => { id = result.current.captureTask('find me')!.id; });
    expect(result.current.getInboxTask(id)?.rawText).toBe('find me');
  });

  it('rejects new captures once MAX_INBOX_ITEMS (100) is reached, via Alert', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const result = await setupLoaded();

    act(() => {
      for (let i = 0; i < 100; i++) result.current.captureTask(`item ${i}`);
    });
    expect(result.current.inboxCount).toBe(100);

    let captured: unknown = 'not-called';
    act(() => {
      captured = result.current.captureTask('101st item');
    });

    expect(captured).toBeNull();
    expect(result.current.inboxCount).toBe(100);
    expect(alertSpy).toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('warns (but still accepts) once the 90-item warning threshold is reached', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const result = await setupLoaded();

    // captureTask reads the count off a ref that only updates once React commits,
    // so each capture needs its own act() to see the previous capture's effect —
    // otherwise every call in one batch would see the same stale (pre-loop) count.
    for (let i = 0; i < 90; i++) {
      act(() => { result.current.captureTask(`item ${i}`); });
    }
    expect(alertSpy).not.toHaveBeenCalled();

    // The warning check reads the count *before* insertion, so it first fires
    // on the 91st capture (count === 90 going in).
    act(() => { result.current.captureTask('item 90'); });

    expect(alertSpy).toHaveBeenCalled();
    expect(result.current.inboxCount).toBe(91);
    alertSpy.mockRestore();
  });

  it('debounce-persists inbox tasks to storage', async () => {
    const result = await setupLoaded();
    act(() => {
      result.current.captureTask('persist me');
    });

    await waitFor(async () => {
      const stored = await getInboxTasks<{ rawText: string }>();
      expect(stored.some(t => t.rawText === 'persist me')).toBe(true);
    }, { timeout: 2000 });
  });
});
