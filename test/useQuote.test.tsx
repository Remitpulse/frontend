import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useQuote, secondsUntil, isQuotableAmount, QUOTE_DEBOUNCE_MS } from "../hooks/useQuote";
import * as api from "../lib/api";

vi.mock("../lib/api", () => ({
  getQuote: vi.fn(),
}));

const getQuoteMock = vi.mocked(api.getQuote);

describe("secondsUntil", () => {
  it("returns 0 for a past timestamp", () => {
    const now = 1_000_000;
    expect(secondsUntil(now - 5_000, now)).toBe(0);
  });

  it("returns 0 for the current timestamp", () => {
    const now = 1_000_000;
    expect(secondsUntil(now, now)).toBe(0);
  });

  it("returns whole seconds remaining for a future timestamp", () => {
    const now = 1_000_000;
    expect(secondsUntil(now + 10_000, now)).toBe(10);
  });

  it("floors partial seconds", () => {
    const now = 1_000_000;
    expect(secondsUntil(now + 10_900, now)).toBe(10);
  });
});

describe("isQuotableAmount", () => {
  it("returns false for empty string", () => {
    expect(isQuotableAmount("")).toBe(false);
  });

  it("returns false for non-numeric input", () => {
    expect(isQuotableAmount("abc")).toBe(false);
  });

  it("returns false for zero", () => {
    expect(isQuotableAmount("0")).toBe(false);
  });

  it("returns false for negative amounts", () => {
    expect(isQuotableAmount("-1")).toBe(false);
  });

  it("returns true for a positive numeric amount", () => {
    expect(isQuotableAmount("10")).toBe(true);
  });

  it("returns true for a positive decimal amount", () => {
    expect(isQuotableAmount("0.5")).toBe(true);
  });
});

describe("useQuote", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    getQuoteMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not call getQuote before the debounce elapses", async () => {
    getQuoteMock.mockResolvedValue({ amountOut: "100", expiresAt: Date.now() + 30_000 });

    renderHook(() => useQuote({ amount: "10", from: "XLM", to: "USDC" }));

    expect(getQuoteMock).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(QUOTE_DEBOUNCE_MS - 1);
    });

    expect(getQuoteMock).not.toHaveBeenCalled();
  });

  it("calls getQuote after the debounce elapses", async () => {
    getQuoteMock.mockResolvedValue({ amountOut: "100", expiresAt: Date.now() + 30_000 });

    renderHook(() => useQuote({ amount: "10", from: "XLM", to: "USDC" }));

    await act(async () => {
      vi.advanceTimersByTime(QUOTE_DEBOUNCE_MS);
    });

    expect(getQuoteMock).toHaveBeenCalledTimes(1);
    expect(getQuoteMock).toHaveBeenCalledWith(
      expect.objectContaining({ amount: "10", from: "XLM", to: "USDC" }),
    );
  });

  it("sets quote and secondsLeft on success", async () => {
    const expiresAt = Date.now() + 30_000;
    getQuoteMock.mockResolvedValue({ amountOut: "100", expiresAt });

    const { result } = renderHook(() =>
      useQuote({ amount: "10", from: "XLM", to: "USDC" }),
    );

    await act(async () => {
      vi.advanceTimersByTime(QUOTE_DEBOUNCE_MS);
    });

    await waitFor(() => {
      expect(result.current.quote).toEqual({ amountOut: "100", expiresAt });
    });

    expect(result.current.error).toBeNull();
    expect(result.current.secondsLeft).toBeGreaterThan(0);
  });

  it("counts down secondsLeft over time", async () => {
    const expiresAt = Date.now() + 30_000;
    getQuoteMock.mockResolvedValue({ amountOut: "100", expiresAt });

    const { result } = renderHook(() =>
      useQuote({ amount: "10", from: "XLM", to: "USDC" }),
    );

    await act(async () => {
      vi.advanceTimersByTime(QUOTE_DEBOUNCE_MS);
    });

    await waitFor(() => {
      expect(result.current.quote).not.toBeNull();
    });

    const initial = result.current.secondsLeft;

    await act(async () => {
      vi.advanceTimersByTime(5_000);
    });

    expect(result.current.secondsLeft).toBeLessThan(initial);
  });

  it("sets error message on failure", async () => {
    getQuoteMock.mockRejectedValue(new Error("network down"));

    const { result } = renderHook(() =>
      useQuote({ amount: "10", from: "XLM", to: "USDC" }),
    );

    await act(async () => {
      vi.advanceTimersByTime(QUOTE_DEBOUNCE_MS);
    });

    await waitFor(() => {
      expect(result.current.error).toBe("network down");
    });

    expect(result.current.quote).toBeNull();
  });

  it("clears quote and does not fetch for non-quotable amounts", async () => {
    getQuoteMock.mockResolvedValue({ amountOut: "100", expiresAt: Date.now() + 30_000 });

    const { result, rerender } = renderHook(
      ({ amount }: { amount: string }) =>
        useQuote({ amount, from: "XLM", to: "USDC" }),
      { initialProps: { amount: "10" } },
    );

    await act(async () => {
      vi.advanceTimersByTime(QUOTE_DEBOUNCE_MS);
    });

    await waitFor(() => {
      expect(result.current.quote).not.toBeNull();
    });

    getQuoteMock.mockClear();

    rerender({ amount: "0" });

    await act(async () => {
      vi.advanceTimersByTime(QUOTE_DEBOUNCE_MS);
    });

    expect(getQuoteMock).not.toHaveBeenCalled();
    expect(result.current.quote).toBeNull();
  });

  it("invalidates in-flight requests when amount becomes non-quotable", async () => {
    let resolveFirst: (value: { amountOut: string; expiresAt: number }) => void = () => {};
    getQuoteMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
    );

    const { result, rerender } = renderHook(
      ({ amount }: { amount: string }) =>
        useQuote({ amount, from: "XLM", to: "USDC" }),
      { initialProps: { amount: "10" } },
    );

    await act(async () => {
      vi.advanceTimersByTime(QUOTE_DEBOUNCE_MS);
    });

    expect(getQuoteMock).toHaveBeenCalledTimes(1);

    rerender({ amount: "" });

    await act(async () => {
      vi.advanceTimersByTime(QUOTE_DEBOUNCE_MS);
    });

    await act(async () => {
      resolveFirst({ amountOut: "100", expiresAt: Date.now() + 30_000 });
    });

    expect(result.current.quote).toBeNull();
  });

  it("refresh() re-fetches the quote", async () => {
    getQuoteMock.mockResolvedValue({ amountOut: "100", expiresAt: Date.now() + 30_000 });

    const { result } = renderHook(() =>
      useQuote({ amount: "10", from: "XLM", to: "USDC" }),
    );

    await act(async () => {
      vi.advanceTimersByTime(QUOTE_DEBOUNCE_MS);
    });

    await waitFor(() => {
      expect(result.current.quote).not.toBeNull();
    });

    expect(getQuoteMock).toHaveBeenCalledTimes(1);

    getQuoteMock.mockResolvedValueOnce({
      amountOut: "200",
      expiresAt: Date.now() + 30_000,
    });

    await act(async () => {
      await result.current.refresh();
    });

    expect(getQuoteMock).toHaveBeenCalledTimes(2);
    await waitFor(() => {
      expect(result.current.quote).toEqual(
        expect.objectContaining({ amountOut: "200" }),
      );
    });
  });
});