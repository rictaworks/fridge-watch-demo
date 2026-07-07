'use client';

/** アラート状態(LED)と ESP32 デバイス状態を表示する(設計 F3)。 */
import { useTranslations } from 'next-intl';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFan, faPlug } from '@/components/fontawesome';
import { useFridge } from './FridgeProvider';

const LED_COLOR_CLASS: Record<string, string> = {
  green: 'green',
  yellow: 'yellow',
  red: 'red',
};

export function StatusPanel() {
  const t = useTranslations();
  const { view } = useFridge();
  const alert = view?.alert;

  const ledClass = alert && alert.ledColor !== 'off' ? (LED_COLOR_CLASS[alert.ledColor] ?? '') : '';
  const levelText = alert ? t(`alert.${alert.levelKey}`) : '-';
  const metaText =
    alert && alert.minDays !== null ? `${t('alert.minDays')}: ${alert.minDays}${t('unit.days')}` : '';
  const fanOn = Boolean(alert?.fanActivated);
  const connected = Boolean(alert?.deviceConnected);

  return (
    <section className="panel status-panel">
      <div className="alert-card">
        <div
          className={`led ${ledClass}`.trimEnd()}
          data-testid="led"
          data-color={alert?.ledColor ?? 'off'}
          aria-hidden
        />
        <div className="alert-text">
          <h2>{t('alert.heading')}</h2>
          <p className="alert-level" data-testid="alert-level">
            {levelText}
          </p>
          <p className="alert-meta">{metaText}</p>
        </div>
      </div>
      <div className="device-card">
        <h3>{t('device.heading')}</h3>
        <p>
          <FontAwesomeIcon icon={faFan} className={fanOn ? 'fan-spin' : ''} aria-hidden />{' '}
          <span>{fanOn ? t('alert.fanOn') : t('alert.fanOff')}</span>
        </p>
        <p>
          <FontAwesomeIcon icon={faPlug} aria-hidden />{' '}
          <span>{connected ? t('alert.deviceConnected') : t('alert.deviceDisconnected')}</span>
        </p>
      </div>
    </section>
  );
}
