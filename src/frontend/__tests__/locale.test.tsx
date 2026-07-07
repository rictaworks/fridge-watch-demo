import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '@testing-library/react';
import { LocaleProvider, useLocaleController } from '@/components/LocaleProvider';

/** 言語切替の検証用コンシューマ。現在ロケール・dir を可視化し、切替ボタンを提供する。 */
function Consumer() {
  const { locale, dir, setLocale } = useLocaleController();
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <span data-testid="dir">{dir}</span>
      <button type="button" onClick={() => setLocale('ar')}>
        to-ar
      </button>
      <button type="button" onClick={() => setLocale('en')}>
        to-en
      </button>
    </div>
  );
}

describe('LocaleProvider 言語切替 / RTL', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.dir = 'ltr';
    document.documentElement.lang = 'ja';
  });

  it('初期は ja / LTR', async () => {
    render(
      <LocaleProvider>
        <Consumer />
      </LocaleProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('locale')).toHaveTextContent('ja'));
    expect(screen.getByTestId('dir')).toHaveTextContent('ltr');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('ar に切り替えると dir=rtl になり html にも反映される', async () => {
    const user = userEvent.setup();
    render(
      <LocaleProvider>
        <Consumer />
      </LocaleProvider>,
    );
    await user.click(screen.getByText('to-ar'));
    await waitFor(() => expect(screen.getByTestId('dir')).toHaveTextContent('rtl'));
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');
    expect(window.localStorage.getItem('fw_locale')).toBe('ar');
  });

  it('en に切り替えると LTR に戻る', async () => {
    const user = userEvent.setup();
    render(
      <LocaleProvider>
        <Consumer />
      </LocaleProvider>,
    );
    await user.click(screen.getByText('to-ar'));
    await waitFor(() => expect(document.documentElement.dir).toBe('rtl'));
    await user.click(screen.getByText('to-en'));
    await waitFor(() => expect(document.documentElement.dir).toBe('ltr'));
    expect(screen.getByTestId('locale')).toHaveTextContent('en');
  });
});
