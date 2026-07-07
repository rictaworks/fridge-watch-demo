/**
 * Font Awesome 初期化。SSR 時の巨大インラインCSSを避けるため autoAddCss を無効化し、
 * CSS は明示 import する(app/layout.tsx)。絵文字は使わずアイコンで表現する。
 */
import { config } from '@fortawesome/fontawesome-svg-core';

config.autoAddCss = false;

export {
  faSnowflake,
  faLanguage,
  faCamera,
  faKeyboard,
  faBoxOpen,
  faPlus,
  faRotate,
  faSliders,
  faTrash,
  faFan,
  faPlug,
  faImage,
} from '@fortawesome/free-solid-svg-icons';
