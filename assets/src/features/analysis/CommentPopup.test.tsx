import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CommentPopup from '@/features/analysis/CommentPopup';

function renderPopup(onSave = vi.fn(), nags: number[] = []) {
  render(
    <CommentPopup comment={null} nags={nags} moveLabel="1. e4" onSave={onSave} onClose={vi.fn()} />,
  );
  return onSave;
}

describe('CommentPopup quality glyphs', () => {
  it('saves the picked glyph as the move’s nags', () => {
    const onSave = renderPopup();

    fireEvent.click(screen.getByTestId('nag-4'));
    fireEvent.click(screen.getByTestId('save-comment'));

    expect(onSave).toHaveBeenCalledWith('', [4]);
  });

  it('toggles a glyph off again, clearing the nags', () => {
    const onSave = renderPopup(vi.fn(), [1]);

    const button = screen.getByTestId('nag-1');
    expect(button).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(button);
    fireEvent.click(screen.getByTestId('save-comment'));

    expect(onSave).toHaveBeenCalledWith('', []);
  });

  it('keeps a single quality glyph — picking one replaces the other', () => {
    const onSave = renderPopup(vi.fn(), [2]);

    fireEvent.click(screen.getByTestId('nag-3'));
    expect(screen.getByTestId('nag-3')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('nag-2')).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(screen.getByTestId('save-comment'));
    expect(onSave).toHaveBeenCalledWith('', [3]);
  });

  it('saves the comment text together with the glyph', () => {
    const onSave = renderPopup();

    fireEvent.change(screen.getByTestId('comment-editor'), { target: { value: 'Sharp!' } });
    fireEvent.click(screen.getByTestId('nag-5'));
    fireEvent.click(screen.getByTestId('save-comment'));

    expect(onSave).toHaveBeenCalledWith('Sharp!', [5]);
  });
});
