import { screen } from '@testing-library/react';
import { renderWithIntl } from './renderWithIntl';
import type { FridgeView } from '@/lib/types';

let mockView: FridgeView | null = null;
jest.mock('@/components/FridgeProvider', () => ({
  useFridge: () => ({ view: mockView }),
}));

import { StatusPanel } from '@/components/StatusPanel';

function viewWith(alert: Partial<FridgeView['alert']>): FridgeView {
  return {
    items: [],
    alert: {
      levelKey: 'safe',
      ledColor: 'green',
      fanActivated: false,
      deviceConnected: true,
      minDays: 5,
      ...alert,
    },
  };
}

describe('StatusPanel (アラート/LED/デバイス)', () => {
  it('危険レベルは赤 LED・危険表示・ファン作動', () => {
    mockView = viewWith({ levelKey: 'danger', ledColor: 'red', fanActivated: true, minDays: 0 });
    renderWithIntl(<StatusPanel />);
    expect(screen.getByTestId('led')).toHaveAttribute('data-color', 'red');
    expect(screen.getByTestId('led').className).toContain('red');
    expect(screen.getByTestId('alert-level')).toHaveTextContent('危険');
    expect(screen.getByText('換気ファン作動中')).toBeInTheDocument();
  });

  it('安全レベルは緑 LED・安全表示', () => {
    mockView = viewWith({ levelKey: 'safe', ledColor: 'green' });
    renderWithIntl(<StatusPanel />);
    expect(screen.getByTestId('led').className).toContain('green');
    expect(screen.getByTestId('alert-level')).toHaveTextContent('安全');
  });

  it('デバイス未接続を表示する', () => {
    mockView = viewWith({ deviceConnected: false });
    renderWithIntl(<StatusPanel />);
    expect(screen.getByText('デバイス未接続')).toBeInTheDocument();
  });

  it('食材なし(off)では LED は消灯(色クラスなし)', () => {
    mockView = viewWith({ levelKey: 'off', ledColor: 'off', minDays: null });
    renderWithIntl(<StatusPanel />);
    const led = screen.getByTestId('led');
    expect(led.className).not.toContain('green');
    expect(led.className).not.toContain('red');
    expect(led.className).not.toContain('yellow');
  });
});
