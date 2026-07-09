import { beforeEach, describe, expect, it } from 'vitest';
import {
  KEYS,
  saveTasks, getTasks,
  saveInboxTasks, getInboxTasks,
  saveArchivedTasks, getArchivedTasks,
  saveUserPreferences, getUserPreferences,
  saveAvatarUri, getAvatarUri,
  saveCategories, getCategories,
  saveActiveCategory, getActiveCategory,
  clearAll,
} from '../../src/core/utils/storage';

describe('Phase 1.4 — storage.ts (AsyncStorage-backed persistence)', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips tasks', async () => {
    await saveTasks([{ id: 't1' }]);
    expect(await getTasks()).toEqual([{ id: 't1' }]);
  });

  it('getTasks defaults to [] when nothing stored', async () => {
    expect(await getTasks()).toEqual([]);
  });

  it('round-trips inbox tasks', async () => {
    await saveInboxTasks([{ id: 'i1' }]);
    expect(await getInboxTasks()).toEqual([{ id: 'i1' }]);
  });

  it('round-trips archived tasks', async () => {
    await saveArchivedTasks([{ id: 'a1' }]);
    expect(await getArchivedTasks()).toEqual([{ id: 'a1' }]);
  });

  it('round-trips user preferences, defaulting to null', async () => {
    expect(await getUserPreferences()).toBeNull();
    await saveUserPreferences({ darkMode: true });
    expect(await getUserPreferences()).toEqual({ darkMode: true });
  });

  it('round-trips the avatar URI', async () => {
    expect(await getAvatarUri()).toBeNull();
    await saveAvatarUri('blob:abc');
    expect(await getAvatarUri()).toBe('blob:abc');
  });

  it('round-trips categories', async () => {
    await saveCategories([{ id: 'work' }]);
    expect(await getCategories()).toEqual([{ id: 'work' }]);
  });

  it('round-trips the active category', async () => {
    expect(await getActiveCategory()).toBeNull();
    await saveActiveCategory('work');
    expect(await getActiveCategory()).toBe('work');
  });

  it('clearAll removes every KEYS entry', async () => {
    await saveTasks([{ id: 't1' }]);
    await saveInboxTasks([{ id: 'i1' }]);
    await saveCategories([{ id: 'work' }]);
    await clearAll();
    for (const key of Object.values(KEYS)) {
      expect(localStorage.getItem(key)).toBeNull();
    }
  });
});
