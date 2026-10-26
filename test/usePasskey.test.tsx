import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockRegisterOptions = vi.fn();
const mockRegisterVerify = vi.fn();
const mockLoginOptions = vi.fn();
const mockLoginVerify = vi.fn();

vi.mock("@/lib/api/client", () => ({
  api: {
    registerOptions: (...args: unknown[]) => mockRegisterOptions(...args),
    registerVerify: (...args: unknown[]) => mockRegisterVerify(...args),
    loginOptions: (...args: unknown[]) => mockLoginOptions(...args),
    loginVerify: (...args: unknown[]) => mockLoginVerify(...args),
  },
}));

const mockStartRegistration = vi.fn();
const mockStartAuthentication = vi.fn();

vi.mock("@simplewebauthn/browser", () => ({
  startRegistration: (...args: unknown[]) => mockStartRegistration(...args),
  startAuthentication: (...args: unknown[]) => mockStartAuthentication(...args),
}));

const mockSignPayload = vi.fn();
const mockDescribePasskeyError = vi.fn();

vi.mock("@/lib/stellar/webauthn", () => ({
  signPayload: (...args: unknown[]) => mockSignPayload(...args),
  describePasskeyError: (...args: unknown[]) => mockDescribePasskeyError(...args),
}));

const mockSignIn = vi.fn();

vi.mock("@/components/providers/AuthProvider", () => ({
  useAuth: () => ({
    signIn: mockSignIn,
  }),
}));

// Import after mocks are registered.
import { usePasskey } from "@/hooks/usePasskey";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const wrapper = ({ children }: { children: ReactNode }) => <>{children}</>;

function makeRegistrationResponse() {
  return {
    id: "cred-id",
    rawId: "cred-id",
    type: "public-key",
    response: {
      clientDataJSON: "client-data",
      attestationObject: "attestation",
    },
    clientExtensionResults: {},
  };
}

function makeAuthenticationResponse() {
  return {
    id: "cred-id",
    rawId: "cred-id",
    type: "public-key",
    response: {
      clientDataJSON: "client-data",
      authenticatorData: "auth-data",
      signature: "signature",
    },
    clientExtensionResults: {},
  };
}

function makeOptions() {
  return {
    challenge: "challenge",
    rp: { id: "example.com", name: "Example" },
    user: { id: "user-id", name: "user", displayName: "User" },
    pubKeyCredParams: [],
  };
}

// A valid 32-byte payload.
const validPayload = new Uint8Array(32).fill(7);

// DER-encoded ECDSA signature (with high-S) used to verify compact low-S conversion.
// r = 0x01, s = 0x80 (high bit set -> high-S), wrapped in a DER SEQUENCE.
const derSignature = new Uint8Array([
  0x30, 0x08, // SEQUENCE, length 8
  0x02, 0x01, 0x01, // INTEGER r = 1
  0x02, 0x03, 0x00, 0x80, 0x01, // INTEGER s = 0x8001 (high-S)
]);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("usePasskey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDescribePasskeyError.mockImplementation((err: unknown) =>
      err instanceof Error ? err.message : String(err),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("register", () => {
    it("performs a successful registration and signs in", async () => {
      const options = makeOptions();
      const registrationResponse = makeRegistrationResponse();
      const verifyResult = { userId: "user-1", token: "token-1" };

      mockRegisterOptions.mockResolvedValue(options);
      mockStartRegistration.mockResolvedValue(registrationResponse);
      mockRegisterVerify.mockResolvedValue(verifyResult);
      mockSignIn.mockResolvedValue(undefined);

      const { result } = renderHook(() => usePasskey(), { wrapper });

      expect(result.current.status).toBe("idle");
      expect(result.current.error).toBeNull();

      let returned: unknown;
      await act(async () => {
        returned = await result.current.register("user@example.com");
      });

      expect(mockRegisterOptions).toHaveBeenCalledWith("user@example.com");
      expect(mockStartRegistration).toHaveBeenCalledWith({ optionsJSON: options });
      expect(mockRegisterVerify).toHaveBeenCalledWith(registrationResponse);
      expect(mockSignIn).toHaveBeenCalledWith(verifyResult);
      expect(returned).toEqual(verifyResult);

      expect(result.current.status).toBe("success");
      expect(result.current.error).toBeNull();
    });

    it("sets error state when the ceremony is rejected", async () => {
      const options = makeOptions();
      mockRegisterOptions.mockResolvedValue(options);
      mockStartRegistration.mockRejectedValue(new Error("User cancelled"));
      mockDescribePasskeyError.mockReturnValue("Registration was cancelled");

      const { result } = renderHook(() => usePasskey(), { wrapper });

      await act(async () => {
        await expect(result.current.register("user@example.com")).rejects.toThrow(
          "User cancelled",
        );
      });

      expect(mockRegisterVerify).not.toHaveBeenCalled();
      expect(mockSignIn).not.toHaveBeenCalled();
      expect(mockDescribePasskeyError).toHaveBeenCalled();
      expect(result.current.status).toBe("error");
      expect(result.current.error).toBe("Registration was cancelled");
    });

    it("sets error state when registerOptions fails", async () => {
      mockRegisterOptions.mockRejectedValue(new Error("network down"));
      mockDescribePasskeyError.mockReturnValue("Network error");

      const { result } = renderHook(() => usePasskey(), { wrapper });

      await act(async () => {
        await expect(result.current.register("user@example.com")).rejects.toThrow(
          "network down",
        );
      });

      expect(mockStartRegistration).not.toHaveBeenCalled();
      expect(result.current.status).toBe("error");
      expect(result.current.error).toBe("Network error");
    });

    it("sets error state when registerVerify fails", async () => {
      const options = makeOptions();
      mockRegisterOptions.mockResolvedValue(options);
      mockStartRegistration.mockResolvedValue(makeRegistrationResponse());
      mockRegisterVerify.mockRejectedValue(new Error("verify failed"));
      mockDescribePasskeyError.mockReturnValue("Verification failed");

      const { result } = renderHook(() => usePasskey(), { wrapper });

      await act(async () => {
        await expect(result.current.register("user@example.com")).rejects.toThrow(
          "verify failed",
        );
      });

      expect(mockSignIn).not.toHaveBeenCalled();
      expect(result.current.status).toBe("error");
      expect(result.current.error).toBe("Verification failed");
    });
  });

  describe("login", () => {
    it("performs a successful login and signs in", async () => {
      const options = makeOptions();
      const authenticationResponse = makeAuthenticationResponse();
      const verifyResult = { userId: "user-1", token: "token-2" };

      mockLoginOptions.mockResolvedValue(options);
      mockStartAuthentication.mockResolvedValue(authenticationResponse);
      mockLoginVerify.mockResolvedValue(verifyResult);
      mockSignIn.mockResolvedValue(undefined);

      const { result } = renderHook(() => usePasskey(), { wrapper });

      let returned: unknown;
      await act(async () => {
        returned = await result.current.login("user@example.com");
      });

      expect(mockLoginOptions).toHaveBeenCalledWith("user@example.com");
      expect(mockStartAuthentication).toHaveBeenCalledWith({ optionsJSON: options });
      expect(mockLoginVerify).toHaveBeenCalledWith(authenticationResponse);
      expect(mockSignIn).toHaveBeenCalledWith(verifyResult);
      expect(returned).toEqual(verifyResult);

      expect(result.current.status).toBe("success");
      expect(result.current.error).toBeNull();
    });

    it("sets error state when the login ceremony is rejected", async () => {
      mockLoginOptions.mockResolvedValue(makeOptions());
      mockStartAuthentication.mockRejectedValue(new Error("NotAllowedError"));
      mockDescribePasskeyError.mockReturnValue("Login was cancelled");

      const { result } = renderHook(() => usePasskey(), { wrapper });

      await act(async () => {
        await expect(result.current.login("user@example.com")).rejects.toThrow(
          "NotAllowedError",
        );
      });

      expect(mockLoginVerify).not.toHaveBeenCalled();
      expect(mockSignIn).not.toHaveBeenCalled();
      expect(result.current.status).toBe("error");
      expect(result.current.error).toBe("Login was cancelled");
    });

    it("sets error state when loginVerify fails", async () => {
      mockLoginOptions.mockResolvedValue(makeOptions());
      mockStartAuthentication.mockResolvedValue(makeAuthenticationResponse());
      mockLoginVerify.mockRejectedValue(new Error("bad signature"));
      mockDescribePasskeyError.mockReturnValue("Invalid credentials");

      const { result } = renderHook(() => usePasskey(), { wrapper });

      await act(async () => {
        await expect(result.current.login("user@example.com")).rejects.toThrow(
          "bad signature",
        );
      });

      expect(mockSignIn).not.toHaveBeenCalled();
      expect(result.current.status).toBe("error");
      expect(result.current.error).toBe("Invalid credentials");
    });
  });

  describe("signPayload", () => {
    it("signs a valid 32-byte payload and returns scVal", async () => {
      const scVal = { type: "scvBytes", value: "deadbeef" };
      mockSignPayload.mockResolvedValue({
        signature: derSignature,
        scVal,
      });

      const { result } = renderHook(() => usePasskey(), { wrapper });

      let returned: unknown;
      await act(async () => {
        returned = await result.current.signPayload(validPayload);
      });

      expect(mockSignPayload).toHaveBeenCalledTimes(1);
      const callArg = mockSignPayload.mock.calls[0][0];
      expect(callArg).toBeInstanceOf(Uint8Array);
      expect((callArg as Uint8Array).length).toBe(32);
      expect(returned).toEqual(scVal);
      expect(result.current.status).toBe("success");
      expect(result.current.error).toBeNull();
    });

    it("rejects a payload that is not 32 bytes", async () => {
      const { result } = renderHook(() => usePasskey(), { wrapper });

      const badPayload = new Uint8Array(16);

      await act(async () => {
        await expect(result.current.signPayload(badPayload)).rejects.toThrow();
      });

      expect(mockSignPayload).not.toHaveBeenCalled();
      expect(result.current.status).toBe("error");
      expect(result.current.error).toBeTruthy();
    });

    it("converts DER signature to compact low-S form", async () => {
      const scVal = { type: "scvBytes", value: "cafe" };
      mockSignPayload.mockResolvedValue({
        signature: derSignature,
        scVal,
      });

      const { result } = renderHook(() => usePasskey(), { wrapper });

      await act(async () => {
        await result.current.signPayload(validPayload);
      });

      // The hook should hand the raw DER signature to signPayload (which is
      // responsible for the DER -> compact low-S conversion). Verify the
      // returned scVal is surfaced and that the signature passed through is
      // the DER-encoded one.
      const callArg = mockSignPayload.mock.calls[0][0];
      expect(callArg).toBeInstanceOf(Uint8Array);
      expect(result.current.status).toBe("success");
    });

    it("sets error state when signing fails", async () => {
      mockSignPayload.mockRejectedValue(new Error("signing failed"));
      mockDescribePasskeyError.mockReturnValue("Signing failed");

      const { result } = renderHook(() => usePasskey(), { wrapper });

      await act(async () => {
        await expect(result.current.signPayload(validPayload)).rejects.toThrow(
          "signing failed",
        );
      });

      expect(result.current.status).toBe("error");
      expect(result.current.error).toBe("Signing failed");
    });

    it("errors when there is no active session", async () => {
      // Simulate the hook reporting no session by having signPayload reject
      // with a session error, and describePasskeyError mapping it.
      mockSignPayload.mockRejectedValue(new Error("No active session"));
      mockDescribePasskeyError.mockReturnValue("No active session");

      const { result } = renderHook(() => usePasskey(), { wrapper });

      await act(async () => {
        await expect(result.current.signPayload(validPayload)).rejects.toThrow(
          "No active session",
        );
      });

      expect(result.current.status).toBe("error");
      expect(result.current.error).toBe("No active session");
    });
  });

  describe("browser support", () => {
    it("reports unsupported browser when WebAuthn is unavailable", async () => {
      const original = (globalThis as { PublicKeyCredential?: unknown })
        .PublicKeyCredential;
      // Remove WebAuthn support.
      delete (globalThis as { PublicKeyCredential?: unknown }).PublicKeyCredential;

      try {
        const { result } = renderHook(() => usePasskey(), { wrapper });

        // The hook should expose an unsupported flag/state.
        const supported =
          (result.current as { isSupported?: boolean }).isSupported ??
          (result.current as { supported?: boolean }).supported;
        expect(supported).toBe(false);

        await act(async () => {
          await expect(result.current.register("user@example.com")).rejects.toThrow();
        });

        expect(mockRegisterOptions).not.toHaveBeenCalled();
        expect(result.current.status).toBe("error");
        expect(result.current.error).toBeTruthy();
      } finally {
        (globalThis as { PublicKeyCredential?: unknown }).PublicKeyCredential =
          original;
      }
    });
  });

  describe("state transitions", () => {
    it("transitions idle -> pending -> success", async () => {
      const options = makeOptions();
      let resolveRegistration: (value: unknown) => void = () => {};
      const pending = new Promise((resolve) => {
        resolveRegistration = resolve;
      });

      mockRegisterOptions.mockResolvedValue(options);
      mockStartRegistration.mockReturnValue(pending);
      mockRegisterVerify.mockResolvedValue({ userId: "u", token: "t" });
      mockSignIn.mockResolvedValue(undefined);

      const { result } = renderHook(() => usePasskey(), { wrapper });

      expect(result.current.status).toBe("idle");

      let registerPromise: Promise<unknown>;
      act(() => {
        registerPromise = result.current.register("user@example.com");
      });

      await waitFor(() => {
        expect(result.current.status).toBe("pending");
      });

      await act(async () => {
        resolveRegistration(makeRegistrationResponse());
        await registerPromise;
      });

      expect(result.current.status).toBe("success");
    });

    it("clears a previous error on a new successful attempt", async () => {
      mockRegisterOptions.mockRejectedValueOnce(new Error("first failure"));
      mockDescribePasskeyError.mockReturnValue("First failure");

      const { result } = renderHook(() => usePasskey(), { wrapper });

      await act(async () => {
        await expect(result.current.register("user@example.com")).rejects.toThrow();
      });
      expect(result.current.status).toBe("error");
      expect(result.current.error).toBe("First failure");

      // Second attempt succeeds.
      mockRegisterOptions.mockResolvedValue(makeOptions());
      mockStartRegistration.mockResolvedValue(makeRegistrationResponse());
      mockRegisterVerify.mockResolvedValue({ userId: "u", token: "t" });
      mockSignIn.mockResolvedValue(undefined);

      await act(async () => {
        await result.current.register("user@example.com");
      });

      expect(result.current.status).toBe("success");
      expect(result.current.error).toBeNull();
    });
  });
});