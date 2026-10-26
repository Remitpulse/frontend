import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSessionKey } from '../hooks/useSessionKey';
import {
  loadSessionKeyRecord,
  sessionSignerFor,
  isSessionKeyActive,
  issueSessionKey,
  sessionKeyCovers,
} from '../lib/stellar/sessionKeys';
import type { SessionKeyRecord } from '../lib/stellar/sessionKeys';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUseAuth = vi.fn();
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

const mockUsePasskey = vi.fn();
vi.mock('../hooks/usePasskey', () => ({
  usePasskey: () => mockUsePasskey(),
}));

const mockIssueSessionKey = vi.fn();
const mockSignPreparedXdr = vi.fn();
const mockConfirmSessionKey = vi.fn();
vi.mock('../lib/api', () => ({
  api: {
    issueSessionKey: (...args: unknown[]) => mockIssueSessionKey(...args),
    signPreparedXdr: (...args: unknown[]) => mockSignPreparedXdr(...args),
    confirmSessionKey: (...args: unknown[]) => mockConfirmSessionKey(...args),
  },
}));

vi.mock('../lib/stellar/sessionKeys', async () => {
  const actual = await vi.importActual<typeof import('../lib/stellar/sessionKeys')>(
    '../lib/stellar/sessionKeys',
  );
  return {
    ...actual,
    loadSessionKeyRecord: vi.fn(),
    sessionSignerFor: vi.fn(),
    isSessionKeyActive: vi.fn(),
    issueSessionKey: vi.fn(),
    sessionKeyCovers: vi.fn(),
  };
});

const mockedLoadSessionKeyRecord = vi.mocked(loadSessionKeyRecord);
const mockedSessionSignerFor = vi.mocked(sessionSignerFor);
const mockedIsSessionKeyActive = vi.mocked(isSessionKeyActive);
const mockedIssueSessionKey = vi.mocked(issueSessionKey);
const mockedSessionKeyCovers = vi.mocked(sessionKeyCovers);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PUBLIC_KEY = 'GABC123PUBLICKEY';
const OTHER_PUBLIC_KEY = 'GDEF456OTHERKEY';

function makeRecord(overrides: Partial<SessionKeyRecord> = {}): SessionKeyRecord {
  return {
    publicKey: PUBLIC_KEY,
    secret: 'S...',
    expiresAt: Date.now() + 60_000,
    maxAmount: '1000',
    ...overrides,
  } as SessionKeyRecord;
}

function makeSigner() {
  return {
    publicKey: PUBLIC_KEY,
    sign: vi.fn().mockResolvedValue('signed-xdr'),
  };
}

const signPayload = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();

  mockUseAuth.mockReturnValue({
    mode: 'demo',
    address: 'GUSERADDRESS',
    isAuthenticated: true,
  });

  mockUsePasskey.mockReturnValue({
    signPayload,
  });

  mockedLoadSessionKeyRecord.mockReturnValue(null);
  mockedSessionSignerFor.mockReturnValue(null);
  mockedIsSessionKeyActive.mockReturnValue(false);
  mockedSessionKeyCovers.mockReturnValue(false);
  mockedIssueSessionKey.mockResolvedValue(makeRecord());
  mockIssueSessionKey.mockResolvedValue({
    xdr: 'prepared-xdr',
    sessionKeyPublic: PUBLIC_KEY,
  });
  mockSignPreparedXdr.mockResolvedValue('signed-xdr');
  mockConfirmSessionKey.mockResolvedValue({ ok: true });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Pure helper unit tests
// ---------------------------------------------------------------------------

describe('loadSessionKeyRecord', () => {
  it('returns null when nothing is stored', () => {
    const storage = { getItem: vi.fn().mockReturnValue(null) } as unknown as Storage;
    expect(loadSessionKeyRecord(storage)).toBeNull();
  });

  it('parses a stored record', () => {
    const record = makeRecord();
    const storage = {
      getItem: vi.fn().mockReturnValue(JSON.stringify(record)),
    } as unknown as Storage;
    expect(loadSessionKeyRecord(storage)).toEqual(record);
  });

  it('returns null on malformed JSON', () => {
    const storage = { getItem: vi.fn().mockReturnValue('{not-json') } as unknown as Storage;
    expect(loadSessionKeyRecord(storage)).toBeNull();
  });
});

describe('sessionSignerFor', () => {
  it('returns null when no record', () => {
    expect(sessionSignerFor(null, '100')).toBeNull();
  });

  it('returns a signer when the record covers the amount', () => {
    const record = makeRecord();
    mockedSessionKeyCovers.mockReturnValue(true);
    const signer = sessionSignerFor(record, '100');
    expect(signer).not.toBeNull();
    expect(mockedSessionKeyCovers).toHaveBeenCalledWith(record, '100');
  });

  it('returns null when the record does not cover the amount', () => {
    const record = makeRecord();
    mockedSessionKeyCovers.mockReturnValue(false);
    expect(sessionSignerFor(record, '5000')).toBeNull();
  });
});

describe('isSessionKeyActive', () => {
  it('is false for null record', () => {
    expect(isSessionKeyActive(null)).toBe(false);
  });

  it('is true for a non-expired record', () => {
    expect(isSessionKeyActive(makeRecord({ expiresAt: Date.now() + 60_000 }))).toBe(true);
  });

  it('is false for an expired record', () => {
    expect(isSessionKeyActive(makeRecord({ expiresAt: Date.now() - 1 }))).toBe(false);
  });
});

describe('issueSessionKey', () => {
  it('issues a session key in demo mode', async () => {
    const record = makeRecord();
    mockedIssueSessionKey.mockResolvedValue(record);
    const result = await issueSessionKey({
      mode: 'demo',
      publicKey: PUBLIC_KEY,
      maxAmount: '1000',
      ttlSeconds: 60,
    } as never);
    expect(result).toEqual(record);
  });
});

// ---------------------------------------------------------------------------
// useSessionKey hook tests
// ---------------------------------------------------------------------------

describe('useSessionKey', () => {
  it('exposes active=false when no record is stored', () => {
    mockedLoadSessionKeyRecord.mockReturnValue(null);
    mockedIsSessionKeyActive.mockReturnValue(false);

    const { result } = renderHook(() => useSessionKey());

    expect(result.current.active).toBe(false);
    expect(result.current.record).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('reflects active=true for a registered, non-expired record', () => {
    const record = makeRecord();
    mockedLoadSessionKeyRecord.mockReturnValue(record);
    mockedIsSessionKeyActive.mockReturnValue(true);

    const { result } = renderHook(() => useSessionKey());

    expect(result.current.active).toBe(true);
    expect(result.current.record).toEqual(record);
  });

  it('reflects active=false for an expired record', () => {
    const record = makeRecord({ expiresAt: Date.now() - 1 });
    mockedLoadSessionKeyRecord.mockReturnValue(record);
    mockedIsSessionKeyActive.mockReturnValue(false);

    const { result } = renderHook(() => useSessionKey());

    expect(result.current.active).toBe(false);
  });

  it('issue() succeeds in demo mode and signs the public key hash', async () => {
    const record = makeRecord();
    mockedIssueSessionKey.mockResolvedValue(record);
    mockedIsSessionKeyActive.mockReturnValue(true);

    const { result } = renderHook(() => useSessionKey());

    await act(async () => {
      await result.current.issue({ maxAmount: '1000', ttlSeconds: 60 });
    });

    expect(mockedIssueSessionKey).toHaveBeenCalled();
    expect(signPayload).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeNull();
    expect(result.current.record).toEqual(record);
    expect(result.current.active).toBe(true);
  });

  it('issue() succeeds in live mode and calls api flow', async () => {
    mockUseAuth.mockReturnValue({
      mode: 'live',
      address: 'GUSERADDRESS',
      isAuthenticated: true,
    });
    const record = makeRecord();
    mockedIssueSessionKey.mockResolvedValue(record);
    mockedIsSessionKeyActive.mockReturnValue(true);

    const { result } = renderHook(() => useSessionKey());

    await act(async () => {
      await result.current.issue({ maxAmount: '1000', ttlSeconds: 60 });
    });

    expect(mockIssueSessionKey).toHaveBeenCalled();
    expect(mockSignPreparedXdr).toHaveBeenCalledWith('prepared-xdr');
    expect(mockConfirmSessionKey).toHaveBeenCalled();
    expect(result.current.error).toBeNull();
    expect(result.current.active).toBe(true);
  });

  it('issue() sets error and rethrows on failure', async () => {
    const boom = new Error('issue failed');
    mockedIssueSessionKey.mockRejectedValue(boom);

    const { result } = renderHook(() => useSessionKey());

    await act(async () => {
      await expect(
        result.current.issue({ maxAmount: '1000', ttlSeconds: 60 }),
      ).rejects.toThrow('issue failed');
    });

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });
  });

  it('revoke() clears the record', async () => {
    const record = makeRecord();
    mockedLoadSessionKeyRecord.mockReturnValue(record);
    mockedIsSessionKeyActive.mockReturnValue(true);

    const { result } = renderHook(() => useSessionKey());

    expect(result.current.record).toEqual(record);

    await act(async () => {
      await result.current.revoke();
    });

    expect(result.current.record).toBeNull();
    expect(result.current.active).toBe(false);
  });

  it('signerFor returns a signer only when the record covers the amount', () => {
    const record = makeRecord();
    const signer = makeSigner();
    mockedLoadSessionKeyRecord.mockReturnValue(record);
    mockedIsSessionKeyActive.mockReturnValue(true);

    mockedSessionSignerFor.mockReturnValue(signer as never);

    const { result } = renderHook(() => useSessionKey());

    const covered = result.current.signerFor('100');
    expect(covered).toEqual(signer);
    expect(mockedSessionSignerFor).toHaveBeenCalledWith(record, '100');

    mockedSessionSignerFor.mockReturnValue(null);
    const notCovered = result.current.signerFor('999999');
    expect(notCovered).toBeNull();
  });

  it('signerFor returns null when there is no active record', () => {
    mockedLoadSessionKeyRecord.mockReturnValue(null);
    mockedIsSessionKeyActive.mockReturnValue(false);

    const { result } = renderHook(() => useSessionKey());

    expect(result.current.signerFor('100')).toBeNull();
  });
});