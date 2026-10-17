// Registers the five bottom sheets.
import { registerSheet } from '../sheets.js';
import { khoSheet } from './kho.js';
import { menuSheet } from './menu.js';
import { upgradeSheet } from './upgrade.js';
import { staffSheet } from './staff.js';
import { shopSheet } from './shop.js';

export function installSheets() {
  registerSheet('kho', khoSheet);
  registerSheet('menu', menuSheet);
  registerSheet('upgrade', upgradeSheet);
  registerSheet('staff', staffSheet);
  registerSheet('shop', shopSheet);
}
installSheets();
