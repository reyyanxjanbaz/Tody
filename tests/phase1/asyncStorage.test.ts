import { beforeEach, describe, expect, it, vi } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';

describe('Phase 1.2 — asyncStorage shim (localStorage-backed AsyncStorage API)', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips getItem/setItem', async () => {
    await AsyncStorage.setItem('k', 'v');
    expect(await AsyncStorage.getItem('k')).toBe('v');
  });

  it('getItem returns null for missing keys', async () => {
    expect(await AsyncStorage.getItem('missing')).toBeNull();
  });

  it('removeItem deletes a key', async () => {
    await AsyncStorage.setItem('k', 'v');
    await AsyncStorage.removeItem('k');
    expect(await AsyncStorage.getItem('k')).toBeNull();
  });

  it('multiSet/multiGet round-trip several pairs', async () => {
    await AsyncStorage.multiSet([['a', '1'], ['b', '2']]);
    expect(await AsyncStorage.multiGet(['a', 'b', 'c'])).toEqual([
      ['a', '1'],
      ['b', '2'],
      ['c', null],
    ]);
  });

  it('multiRemove deletes several keys at once', async () => {
    await AsyncStorage.multiSet([['a', '1'], ['b', '2']]);
    await AsyncStorage.multiRemove(['a', 'b']);
    expect(await AsyncStorage.getItem('a')).toBeNull();
    expect(await AsyncStorage.getItem('b')).toBeNull();
  });

  it('getAllKeys lists every stored key', async () => {
    await AsyncStorage.multiSet([['a', '1'], ['b', '2']]);
    expect((await AsyncStorage.getAllKeys()).sort()).toEqual(['a', 'b']);
  });

  it('clear wipes everything', async () => {
    await AsyncStorage.setItem('k', 'v');
    await AsyncStorage.clear();
    expect(await AsyncStorage.getAllKeys()).toEqual([]);
  });

  it('mergeItem shallow-merges JSON objects', async () => {
    await AsyncStorage.setItem('obj', JSON.stringify({ a: 1, b: 1 }));
    await AsyncStorage.mergeItem('obj', JSON.stringify({ b: 2, c: 3 }));
    expect(JSON.parse((await AsyncStorage.getItem('obj'))!)).toEqual({ a: 1, b: 2, c: 3 });
  });

  it('never throws when the underlying localStorage throws (private mode / quota)', async () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    await expect(AsyncStorage.setItem('k', 'v')).resolves.toBeUndefined();
    spy.mockRestore();
  });
});
