// Installs every modal screen into ctx.modals (called once by mountUI).
import { ctx } from '../ctx.js';
import { openReport } from './report.js';
import { openLevelUp, openTierUp, openChest, openLogin } from './rewards.js';
import { openOffline, openEnding, openSettings, openRoadmap, tableInfo, bootChecks } from './misc.js';

export function installModalScreens() {
  ctx.modals = Object.assign(ctx.modals || {}, {
    report: openReport, levelUp: openLevelUp, tierUp: openTierUp, chest: openChest, login: openLogin,
    offline: openOffline, ending: openEnding, settings: openSettings, roadmap: openRoadmap, bootChecks,
  });
  ctx.tableInfo = tableInfo;
}
