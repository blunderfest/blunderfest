import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import EvalBar from '@/features/analysis/EvalBar';

describe('EvalBar', () => {
  it('renders a balanced bar and no label without an eval', () => {
    render(<EvalBar eval={null} label="Eval bar" />);
    expect(screen.getByTestId('eval-bar')).toBeInTheDocument();
    expect(screen.queryByTestId('eval-label')).not.toBeInTheDocument();
  });

  it('shows the evaluation from white perspective with a label', () => {
    render(<EvalBar eval={{ type: 'cp', cp: 125 }} label="Engine evaluation: +1.25" />);
    expect(screen.getByTestId('eval-label')).toHaveTextContent('+1.25');
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Engine evaluation: +1.25');
  });

  it('shows a mate label', () => {
    render(<EvalBar eval={{ type: 'mate', moves: -2 }} label="Engine evaluation: -M2" />);
    expect(screen.getByTestId('eval-label')).toHaveTextContent('-M2');
  });

  it('gives white the majority of the bar when white is winning', () => {
    render(<EvalBar eval={{ type: 'cp', cp: 200 }} label="" />);
    const white = screen.getByTestId('eval-white');
    expect(white.style.height).toBe('62%');
  });
});
