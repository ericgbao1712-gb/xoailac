// Art API barrel (frozen — see TECH_SPEC.md §2). Render/UI import from here.
export { PAL, BROTH, SKIN, HAIR } from './palette.js';
export { artReady } from './assets.js';
export { getLayout, sceneForTier, SCENES } from './layouts.js';
export { ICONS, drawIcon, iconURL } from './icons.js';
export { drawStamp, stampCanvas } from './brand.js';
export { CHAR_W, CHAR_H, makeLook, makeOwnerLook, makeStaffLook, drawChar, portraitURL, setUniform } from './characters.js';
export {
  drawSceneBack, sceneDrawables, drawSceneFront, drawTable, drawSideTable, drawStove, drawSteam, drawCoinPile,
  drawBubble, drawParticle, drawVehicle, drawWeather, drawCanopy, drawLighting, decoIconURL, sceneThumbURL,
} from './scenes.js';
