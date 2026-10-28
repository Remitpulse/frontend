import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUseAuth = vi.fn();
vi.mock('../hooks/useAuth', () => ({
  useAuth: (...args: unknown[]) => mockUseAuth(...args),
}));

const mockUsePasskey = vi.fn();
vi.mock('../hooks/usePasskey', () => ({
  usePasskey: (...args: unknown[]) => mockUsePasskey(...args),
}));

const mockUseSessionKey = vi.fn();
vi.mock('../hooks/useSessionKey', () => ({
  useSessionKey: (...args: unknown[]) => mockUseSessionKey(...args),
}));

const mockCreateTransfer = vi.fn();
vi.mock('../lib/api', () => ({
  api: {
    createTransfer: (...args: unknown[]) => mockCreateTransfer(...args),
  },
}));

const mockBuildTokenTransfer = vi.fn();
const mockSignDemoPayload = vi.fn();
vi.mock('../lib/stellar/smartAccount', () => ({
  buildTokenTransfer: (...args: unknown[]) => mockBuildTokenTransfer(...args),
  signDemoPayload: (...args: unknown[]) => mockSignDemoPayload(...args),
}));

import {
  useSendTransfer,
  resolveWillUseSessionKey,
  selectSigner,
  authTtlForFunding,
  signDemoPayload,
} from '../hooks/useSendTransfer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEMO_PUBLIC_KEY = 'GDEMO1234567890';
const REAL_PUBLIC_KEY = 'GREAL1234567890';
const RECIPIENT = 'GRECIPIENT1234567890';
const AMOUNT = '10.5';

function makeAuth(overrides: Record<string, unknown> = {}) {
  return {
    publicKey: DEMO_PUBLIC_KEY,
    isDemo: true,
    isAuthenticated: true,
    ...overrides,
  };
}

function makePasskey(overrides: Record<string, unknown> = {}) {
  return {
    sign: vi.fn().mockResolvedValue({ signature: 'passkey-sig' }),
    ...overrides,
  };
}

function makeSessionKey(overrides: Record<string, unknown> = {}) {
  return {
    signerFor: vi.fn().mockResolvedValue({ signer: 'session', signature: 'session-sig' }),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Pure helper tests
// ---------------------------------------------------------------------------

describe('resolveWillUseSessionKey', () => {
  it('returns true when session key is available and within caps', () => {
    const result = resolveWillUseSessionKey({
      sessionKeyAvailable: true,
      amount: '5',
      amountCap: '10',
      now: 1000,
      expiresAt: 2000,
    });
    expect(result).toBe(true);
  });

  it('returns false when session key is not available', () => {
    const result = resolveWillUseSessionKey({
      sessionKeyAvailable: false,
      amount: '5',
      amountCap: '10',
      now: 1000,
      expiresAt: 2000,
    });
    expect(result).toBe(false);
  });

  it('returns false when amount exceeds cap', () => {
    const result = resolveWillUseSessionKey({
      sessionKeyAvailable: true,
      amount: '15',
      amountCap: '10',
      now: 1000,
      expiresAt: 2000,
    });
    expect(result).toBe(false);
  });

  it('returns false when session key is expired', () => {
    const result = resolveWillUseSessionKey({
      sessionKeyAvailable: true,
      amount: '5',
      amountCap: '10',
      now: 3000,
      expiresAt: 2000,
    });
    expect(result).toBe(false);
  });
});

describe('selectSigner', () => {
  it('returns "session" when willUseSessionKey is true', () => {
    expect(selectSigner(true)).toBe('session');
  });

  it('returns "passkey" when willUseSessionKey is false', () => {
    expect(selectSigner(false)).toBe('passkey');
  });
});

describe('authTtlForFunding', () => {
  it('returns a positive TTL for a given funding amount', () => {
    const ttl = authTtlForFunding('10');
    expect(typeof ttl).toBe('number');
    expect(ttl).toBeGreaterThan(0);
  });

  it('scales TTL with funding amount', () => {
    const small = authTtlForFunding('1');
    const large = authTtlForFunding('100');
    expect(large).toBeGreaterThanOrEqual(small);
  });
});

describe('signDemoPayload', () => {
  beforeEach(() => {
    mockSignDemoPayload.mockReset();
  });

  it('delegates to smartAccount.signDemoPayload', async () => {
    mockSignDemoPayload.mockResolvedValue({ signature: 'demo-sig' });
    const payload = { to: RECIPIENT, amount: AMOUNT };
    const result = await signDemoPayload(payload as never);
    expect(mockSignDemoPayload).toHaveBeenCalledWith(payload);
    expect(result).toEqual({ signature: 'demo-sig' });
  });

  it('propagates errors from signDemoPayload', async () => {
    mockSignDemoPayload.mockRejectedValue(new Error('sign failed'));
    await expect(signDemoPayload({} as never)).rejects.toThrow('sign failed');
  });
});

// ---------------------------------------------------------------------------
// Hook tests
// ---------------------------------------------------------------------------

describe('useSendTransfer', () => {
  let passkey: ReturnType<typeof makePasskey>;
  let sessionKey: ReturnType<typeof makeSessionKey>;

  beforeEach(() => {
    mockUseAuth.mockReset();
    mockUsePasskey.mockReset();
    mockUseSessionKey.mockReset();
    mockCreateTransfer.mockReset();
    mockBuildTokenTransfer.mockReset();
    mockSignDemoPayload.mockReset();

    passkey = makePasskey();
    sessionKey = makeSessionKey();

    mockUsePasskey.mockReturnValue(passkey);
    mockUseSessionKey.mockReturnValue(sessionKey);
    mockUseAuth.mockReturnValue(makeAuth());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('throws when unauthenticated', async () => {
    mockUseAuth.mockReturnValue(makeAuth({ isAuthenticated: false, publicKey: null }));

    const { result } = renderHook(() => useSendTransfer());

    await expect(
      act(async () => {
        await result.current.sendTransfer({ to: RECIPIENT, amount: AMOUNT });
      }),
    ).rejects.toThrow();

    expect(mockCreateTransfer).not.toHaveBeenCalled();
  });

  it('success path in demo mode uses signDemoPayload and passkey signer', async () => {
    mockSignDemoPayload.mockResolvedValue({ signature: 'demo-sig' });
    mockCreateTransfer.mockResolvedValue({ id: 'tx-1', status: 'pending' });

    const { result } = renderHook(() => useSendTransfer());

    await act(async () => {
      await result.current.sendTransfer({ to: RECIPIENT, amount: AMOUNT });
    });

    expect(mockSignDemoPayload).toHaveBeenCalled();
    expect(mockCreateTransfer).toHaveBeenCalledTimes(1);

    const callArg = mockCreateTransfer.mock.calls[0][0] as Record<string, unknown>;
    expect(callArg.signer).toBe('passkey');
    expect(callArg.to).toBe(RECIPIENT);
    expect(callArg.amount).toBe(AMOUNT);

    await waitFor(() => {
      expect(result.current.phase).toBe('success');
    });
    expect(result.current.error).toBeNull();
  });

  it('success path in demo mode uses session signer when session key applies', async () => {
    mockSignDemoPayload.mockResolvedValue({ signature: 'demo-sig' });
    mockCreateTransfer.mockResolvedValue({ id: 'tx-2', status: 'pending' });

    // Session key available and within caps.
    sessionKey.signerFor.mockResolvedValue({ signer: 'session', signature: 'session-sig' });

    const { result } = renderHook(() => useSendTransfer());

    await act(async () => {
      await result.current.sendTransfer({
        to: RECIPIENT,
        amount: AMOUNT,
        useSessionKey: true,
      });
    });

    expect(mockCreateTransfer).toHaveBeenCalledTimes(1);
    const callArg = mockCreateTransfer.mock.calls[0][0] as Record<string, unknown>;
    expect(callArg.signer).toBe('session');
  });

  it('success path in non-demo mode calls buildTokenTransfer', async () => {
    mockUseAuth.mockReturnValue(
      makeAuth({ isDemo: false, publicKey: REAL_PUBLIC_KEY }),
    );
    mockBuildTokenTransfer.mockResolvedValue({ xdr: 'built-xdr' });
    passkey.sign.mockResolvedValue({ signature: 'passkey-sig' });
    mockCreateTransfer.mockResolvedValue({ id: 'tx-3', status: 'pending' });

    const { result } = renderHook(() => useSendTransfer());

    await act(async () => {
      await result.current.sendTransfer({ to: RECIPIENT, amount: AMOUNT });
    });

    expect(mockBuildTokenTransfer).toHaveBeenCalledTimes(1);
    expect(mockCreateTransfer).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(result.current.phase).toBe('success');
    });
  });

  it('error path sets phase "error" and error message', async () => {
    mockSignDemoPayload.mockResolvedValue({ signature: 'demo-sig' });
    mockCreateTransfer.mockRejectedValue(new Error('network down'));

    const { result } = renderHook(() => useSendTransfer());

    await act(async () => {
      await result.current.sendTransfer({ to: RECIPIENT, amount: AMOUNT });
    });

    await waitFor(() => {
      expect(result.current.phase).toBe('error');
    });
    expect(result.current.error).toBe('network down');
  });

  it('willUseSessionKey delegates to sessionKey.signerFor', async () => {
    mockSignDemoPayload.mockResolvedValue({ signature: 'demo-sig' });
    mockCreateTransfer.mockResolvedValue({ id: 'tx-4', status: 'pending' });

    const { result } = renderHook(() => useSendTransfer());

    await act(async () => {
      await result.current.sendTransfer({
        to: RECIPIENT,
        amount: AMOUNT,
        useSessionKey: true,
      });
    });

    expect(sessionKey.signerFor).toHaveBeenCalled();
  });
});