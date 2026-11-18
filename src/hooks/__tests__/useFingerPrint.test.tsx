import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useFingerPrint } from '../useFingerPrint';

const get = vi.fn().mockResolvedValue({ visitorId: 'visitor-123' });
const load = vi.fn().mockResolvedValue({ get });

vi.mock('@fingerprintjs/fingerprintjs', () => ({
  default: { load },
}));

describe('useFingerPrint', () => {
  beforeEach(() => {
    load.mockClear();
    get.mockClear();
  });

  it('does not load fingerprinting until the optional feedback UI is opened', async () => {
    const { result, rerender } = renderHook(
      ({ enabled }) => useFingerPrint(enabled),
      { initialProps: { enabled: false } },
    );

    expect(result.current).toBeNull();
    expect(load).not.toHaveBeenCalled();

    rerender({ enabled: true });
    await waitFor(() => expect(result.current).toBe('visitor-123'));
    expect(load).toHaveBeenCalledOnce();
    expect(load).toHaveBeenCalledWith({ monitoring: false });
    expect(get).toHaveBeenCalledOnce();
  });
});
