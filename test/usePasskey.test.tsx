// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Mocks — real import paths only. Each factory owns its vi.fn()s so there is
// no hoisting hazard; tests configure behaviour via the imported mocks below.
// ---------------------------------------------------------------------------

vi.mock('@/lib/api/client', () => ({
  api: {
    registerOptions: vi.fn(),
    registerVerify: vi.fn(),
    loginOptions: vi.fn(),
    loginVerify: vi.fn(),
  },
}))

vi.mock('@simplewebauthn/browser', () => ({
  WebAuthnError: class WebAuthnError extends Error {
    code: string
    constructor({ message, code }: { message: string; code: string }) {
      super(message)
      this.name = 'WebAuthnError'
      this.code = code
    }
  },
  browserSupportsWebAuthn: vi.fn(() => true),
  startRegistration: vi.fn(),
  startAuthentication: vi.fn(),
}))

vi.mock('@/components/providers/AuthProvider', () => ({
  useAuth: vi.fn(),
}))

vi.mock('@/lib/config', () => ({
  config: { webauthn: { rpId: 'example.com', rpName: 'RemitPulse' } },
}))

vi.mock('@/lib/stellar/signatures', () => ({
  webAuthnSignatureScVal: vi.fn(),
}))

vi.mock('@/lib/stellar/webauthn', () => ({
  base64UrlToBytes: vi.fn((s: string) => new TextEncoder().encode(s)),
  bytesToBase64Url: vi.fn((b: Uint8Array) => `b64url:${b.length}`),
  bytesToHex: vi.fn(() => 'deadbeef'),
  derToCompactLowS: vi.fn(() => new Uint8Array(64).fill(9)),
  extractP256PublicKey: vi.fn(() => new Uint8Array(65).fill(4)),
  verifyClientData: vi.fn(),
}))

import { usePasskey } from '@/hooks/usePasskey'
import { api } from '@/lib/api/client'
import {
  WebAuthnError,
  browserSupportsWebAuthn,
  startAuthentication,
  startRegistration,
} from '@simplewebauthn/browser'
import { useAuth } from '@/components/providers/AuthProvider'
import { webAuthnSignatureScVal } from '@/lib/stellar/signatures'
import { verifyClientData } from '@/lib/stellar/webauthn'

const mockedRegisterOptions = vi.mocked(api.registerOptions)
const mockedRegisterVerify = vi.mocked(api.registerVerify)
const mockedLoginOptions = vi.mocked(api.loginOptions)
const mockedLoginVerify = vi.mocked(api.loginVerify)
const mockedStartRegistration = vi.mocked(startRegistration)
const mockedStartAuthentication = vi.mocked(startAuthentication)
const mockedBrowserSupportsWebAuthn = vi.mocked(browserSupportsWebAuthn)
const mockedUseAuth = vi.mocked(useAuth)
const mockedWebAuthnSignatureScVal = vi.mocked(webAuthnSignatureScVal)
const mockedVerifyClientData = vi.mocked(verifyClientData)

const mockSignIn = vi.fn()

const SESSION = {
  token: 'tok',
  contractId: 'CCONTRACT',
  credentialId: 'cred-1',
  displayName: 'Ada',
}

const MOCK_SCVAL = { type: 'mockScVal' } as unknown as ReturnType<typeof webAuthnSignatureScVal>

function makeOptions() {
  return {
    challenge: 'challenge',
    rp: { name: 'RemitPulse' },
    user: { id: 'user-id', name: 'ada', displayName: 'Ada' },
    pubKeyCredParams: [{ type: 'public-key' as const, alg: -257 }],
  }
}

function makeLoginOptions() {
  return { challenge: 'challenge' }
}

function makeRegistrationResponse() {
  return {
    id: 'cred-1',
    response: { attestationObject: 'attestation', clientDataJSON: 'client-data' },
  }
}

function makeAuthenticationResponse() {
  return {
    id: 'cred-1',
    response: {
      clientDataJSON: 'client-data',
      authenticatorData: 'auth-data',
      signature: 'signature',
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  mockedBrowserSupportsWebAuthn.mockReturnValue(true)
  mockedUseAuth.mockReturnValue({
    session: SESSION,
    ready: true,
    signIn: mockSignIn,
    signOut: vi.fn(),
  })
  mockedWebAuthnSignatureScVal.mockReturnValue(MOCK_SCVAL)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('usePasskey', () => {
  describe('register', () => {
    it('registers successfully, rewrites rp/pubKeyCredParams, and signs in', async () => {
      const options = makeOptions()
      const response = makeRegistrationResponse()
      mockedRegisterOptions.mockResolvedValue({ options } as never)
      mockedStartRegistration.mockResolvedValue(response as never)
      mockedRegisterVerify.mockResolvedValue(SESSION as never)

      const { result } = renderHook(() => usePasskey())
      expect(result.current.status).toBe('idle')

      let returned: unknown
      await act(async () => {
        returned = await result.current.register('Ada')
      })

      expect(localStorage.getItem('rp-display-name')).toBe('Ada')
      expect(mockedRegisterOptions).toHaveBeenCalledWith('Ada')
      expect(mockedStartRegistration).toHaveBeenCalledWith({
        optionsJSON: {
          ...options,
          rp: { ...options.rp, id: 'example.com' },
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
        },
      })
      expect(mockedRegisterVerify).toHaveBeenCalledWith({ response, publicKeyHex: 'deadbeef' })
      expect(mockSignIn).toHaveBeenCalledWith(SESSION)
      expect(returned).toEqual(SESSION)
      expect(result.current.status).toBe('idle')
      expect(result.current.error).toBeNull()
    })

    it('keeps an explicit rp.id from the server instead of the config fallback', async () => {
      const options = { ...makeOptions(), rp: { id: 'server.example', name: 'RemitPulse' } }
      mockedRegisterOptions.mockResolvedValue({ options } as never)
      mockedStartRegistration.mockResolvedValue(makeRegistrationResponse() as never)
      mockedRegisterVerify.mockResolvedValue(SESSION as never)

      const { result } = renderHook(() => usePasskey())
      await act(async () => {
        await result.current.register('Ada')
      })

      const call = mockedStartRegistration.mock.calls[0]![0] as {
        optionsJSON: { rp: { id: string } }
      }
      expect(call.optionsJSON.rp.id).toBe('server.example')
    })

    it('sets error state and rethrows when the ceremony is rejected', async () => {
      mockedRegisterOptions.mockResolvedValue({ options: makeOptions() } as never)
      const boom = new WebAuthnError({
        message: 'User cancelled',
        code: 'ERROR_CEREMONY_ABORTED',
        cause: new Error('User cancelled'),
      })
      mockedStartRegistration.mockRejectedValue(boom)

      const { result } = renderHook(() => usePasskey())
      await act(async () => {
        await expect(result.current.register('Ada')).rejects.toThrow('User cancelled')
      })

      expect(mockedRegisterVerify).not.toHaveBeenCalled()
      expect(mockSignIn).not.toHaveBeenCalled()
      expect(result.current.status).toBe('error')
      expect(result.current.error).toBe(
        'The passkey prompt was closed or timed out. Try again when you’re ready.',
      )
    })

    it('rejects without calling the API when the browser does not support WebAuthn', async () => {
      mockedBrowserSupportsWebAuthn.mockReturnValue(false)

      const { result } = renderHook(() => usePasskey())
      await act(async () => {
        await expect(result.current.register('Ada')).rejects.toThrow()
      })

      expect(mockedRegisterOptions).not.toHaveBeenCalled()
      expect(result.current.status).toBe('error')
      expect(result.current.error).toBe(
        'This browser doesn’t support passkeys. Try Safari, Chrome, or Edge on a recent device.',
      )
    })
  })

  describe('login', () => {
    it('logs in successfully with no displayName argument and signs in', async () => {
      const options = makeLoginOptions()
      const response = makeAuthenticationResponse()
      mockedLoginOptions.mockResolvedValue({ options } as never)
      mockedStartAuthentication.mockResolvedValue(response as never)
      mockedLoginVerify.mockResolvedValue(SESSION as never)

      const { result } = renderHook(() => usePasskey())

      let returned: unknown
      await act(async () => {
        returned = await result.current.login()
      })

      expect(mockedLoginOptions).toHaveBeenCalledWith()
      expect(mockedStartAuthentication).toHaveBeenCalledWith({
        optionsJSON: { ...options, rpId: 'example.com' },
      })
      expect(mockedLoginVerify).toHaveBeenCalledWith({ response })
      expect(mockSignIn).toHaveBeenCalledWith(SESSION)
      expect(returned).toEqual(SESSION)
      expect(result.current.status).toBe('idle')
      expect(result.current.error).toBeNull()
    })

    it('sets error state and rethrows when the login ceremony is rejected', async () => {
      mockedLoginOptions.mockResolvedValue({ options: makeLoginOptions() } as never)
      mockedStartAuthentication.mockRejectedValue(new Error('NotAllowedError'))

      const { result } = renderHook(() => usePasskey())
      await act(async () => {
        await expect(result.current.login()).rejects.toThrow('NotAllowedError')
      })

      expect(mockedLoginVerify).not.toHaveBeenCalled()
      expect(mockSignIn).not.toHaveBeenCalled()
      expect(result.current.status).toBe('error')
      expect(result.current.error).toBeTruthy()
    })
  })

  describe('signPayload', () => {
    const validPayload = new Uint8Array(32).fill(7)

    it('signs a valid 32-byte payload and returns the assertion with scVal', async () => {
      const response = makeAuthenticationResponse()
      mockedStartAuthentication.mockResolvedValue(response as never)

      const { result } = renderHook(() => usePasskey())

      let returned: Awaited<ReturnType<typeof result.current.signPayload>> | undefined
      await act(async () => {
        returned = await result.current.signPayload(validPayload)
      })

      expect(mockedStartAuthentication).toHaveBeenCalledWith({
        optionsJSON: {
          challenge: 'b64url:32',
          rpId: 'example.com',
          allowCredentials: [{ id: SESSION.credentialId, type: 'public-key' }],
          userVerification: 'required',
          timeout: 60_000,
        },
      })
      expect(mockedVerifyClientData).toHaveBeenCalledWith(response.response.clientDataJSON, {
        challenge: validPayload,
        type: 'webauthn.get',
      })
      expect(returned?.signature).toEqual(new Uint8Array(64).fill(9))
      expect(returned?.scVal).toBe(MOCK_SCVAL)
      expect(result.current.status).toBe('idle')
      expect(result.current.error).toBeNull()
    })

    it('rejects a payload that is not 32 bytes without starting a ceremony', async () => {
      const { result } = renderHook(() => usePasskey())

      await act(async () => {
        await expect(result.current.signPayload(new Uint8Array(16))).rejects.toThrow(
          'Soroban auth payload must be 32 bytes',
        )
      })

      expect(mockedStartAuthentication).not.toHaveBeenCalled()
      expect(result.current.status).toBe('error')
      expect(result.current.error).toBe('Soroban auth payload must be 32 bytes')
    })

    it('rejects when there is no active session', async () => {
      mockedUseAuth.mockReturnValue({
        session: null,
        ready: true,
        signIn: mockSignIn,
        signOut: vi.fn(),
      })

      const { result } = renderHook(() => usePasskey())

      await act(async () => {
        await expect(result.current.signPayload(validPayload)).rejects.toThrow(
          'Log in with your passkey first.',
        )
      })

      expect(mockedStartAuthentication).not.toHaveBeenCalled()
      expect(result.current.status).toBe('error')
      expect(result.current.error).toBe('Log in with your passkey first.')
    })

    it('sets error state when the authenticator rejects the ceremony', async () => {
      mockedStartAuthentication.mockRejectedValue(new Error('signing failed'))

      const { result } = renderHook(() => usePasskey())

      await act(async () => {
        await expect(result.current.signPayload(validPayload)).rejects.toThrow('signing failed')
      })

      expect(result.current.status).toBe('error')
      expect(result.current.error).toBe('signing failed')
    })
  })

  describe('signer', () => {
    it('resolves to the scVal produced by signPayload', async () => {
      mockedStartAuthentication.mockResolvedValue(makeAuthenticationResponse() as never)

      const { result } = renderHook(() => usePasskey())

      let scVal: unknown
      await act(async () => {
        scVal = await result.current.signer(new Uint8Array(32).fill(1))
      })

      expect(scVal).toBe(MOCK_SCVAL)
    })
  })

  describe('clearError / isBusy', () => {
    it('clearError resets error and status to idle', async () => {
      mockedRegisterOptions.mockRejectedValue(new Error('network down'))

      const { result } = renderHook(() => usePasskey())
      await act(async () => {
        await expect(result.current.register('Ada')).rejects.toThrow()
      })
      expect(result.current.status).toBe('error')
      expect(result.current.error).toBeTruthy()

      act(() => {
        result.current.clearError()
      })

      expect(result.current.status).toBe('idle')
      expect(result.current.error).toBeNull()
    })

    it('is busy while the registration ceremony is pending', async () => {
      mockedRegisterOptions.mockResolvedValue({ options: makeOptions() } as never)
      let resolveCeremony: (value: unknown) => void = () => {}
      mockedStartRegistration.mockReturnValue(
        new Promise((resolve) => {
          resolveCeremony = resolve
        }) as never,
      )
      mockedRegisterVerify.mockResolvedValue(SESSION as never)

      const { result } = renderHook(() => usePasskey())
      expect(result.current.isBusy).toBe(false)

      let pending!: Promise<unknown>
      act(() => {
        pending = result.current.register('Ada')
      })

      await waitFor(() => expect(result.current.isBusy).toBe(true))
      expect(result.current.status).toBe('prompting')

      await act(async () => {
        resolveCeremony(makeRegistrationResponse())
        await pending
      })

      expect(result.current.isBusy).toBe(false)
      expect(result.current.status).toBe('idle')
    })
  })
})
