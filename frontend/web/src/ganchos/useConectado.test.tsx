import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useConectado } from './useConectado';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useConectado', () => {
  it('acompanha navigator.onLine e os eventos online/offline', () => {
    const espiao = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    const { result } = renderHook(() => useConectado());
    expect(result.current).toBe(true);

    espiao.mockReturnValue(false);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current).toBe(false);

    espiao.mockReturnValue(true);
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(result.current).toBe(true);
  });
});
