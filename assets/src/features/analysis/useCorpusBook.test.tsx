import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetBookStatsCache, useCorpusBook } from '@/features/analysis/useCorpusBook';

vi.mock('@/lib/api', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/api')>();
  return { ...original, fetchBook: vi.fn() };
});

const { fetchBook } = await import('@/lib/api');
const mockFetchBook = vi.mocked(fetchBook);

const FEN_A = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
const FEN_B = 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1';

describe('useCorpusBook', () => {
  beforeEach(() => {
    resetBookStatsCache();
    mockFetchBook.mockReset();
    mockFetchBook.mockResolvedValue({ moves: [] });
  });

  it('starts loading and lands the fetched moves', async () => {
    mockFetchBook.mockResolvedValue({
      moves: [{ move: 'e5', games: 3, white: 1, draw: 1, black: 1 }],
    });
    const { result } = renderHook(() => useCorpusBook(FEN_A));

    expect(result.current.kind).toBe('loading');
    await waitFor(() => expect(result.current.kind).toBe('ready'));
    if (result.current.kind === 'ready') {
      expect(result.current.moves).toHaveLength(1);
    }
    expect(mockFetchBook).toHaveBeenCalledWith(FEN_A);
  });

  it('caches per FEN — a remount with the same FEN does not refetch', async () => {
    const { result } = renderHook(() => useCorpusBook(FEN_A));
    await waitFor(() => expect(result.current.kind).toBe('ready'));

    const second = renderHook(() => useCorpusBook(FEN_A));
    // Synchronously ready from the module cache — no second request.
    expect(second.result.current.kind).toBe('ready');
    expect(mockFetchBook).toHaveBeenCalledTimes(1);
  });

  it('refetches for a new FEN', async () => {
    const { result, rerender } = renderHook(({ fen }) => useCorpusBook(fen), {
      initialProps: { fen: FEN_A as string | null },
    });
    await waitFor(() => expect(result.current.kind).toBe('ready'));

    rerender({ fen: FEN_B });
    expect(result.current.kind).toBe('loading');
    await waitFor(() => expect(result.current.kind).toBe('ready'));
    expect(mockFetchBook).toHaveBeenCalledTimes(2);
  });

  it('is ready-empty for a null position without fetching', () => {
    const { result } = renderHook(() => useCorpusBook(null));
    expect(result.current).toEqual({ kind: 'ready', moves: [] });
    expect(mockFetchBook).not.toHaveBeenCalled();
  });

  it('reports a failed fetch', async () => {
    mockFetchBook.mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useCorpusBook(FEN_A));
    await waitFor(() => expect(result.current.kind).toBe('failed'));
  });
});
