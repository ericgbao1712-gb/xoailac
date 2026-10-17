// Satisfaction → stars, rating average, written reviews (TECH_SPEC §6.8).
import * as C from '../config.js';
import { clamp } from './util.js';
import { fill } from './format.js';
import { POT, ambienceOf, mods, potPrice, sellPrice, tierDef, eventDef, perkFx } from './economy.js';

const SAT = C.SAT;

/** Best charm among waiters/cashier → score bonus */
export function charmBonus(G) {
  let best = 0;
  for (const m of G.state.staff) if (m.role === 'phucvu' || m.role === 'thungan') best = Math.max(best, m.chm);
  return (best / 10) * SAT.charmMax;
}

export function makerBonus(G, maker) {
  if (!maker || maker.type === 'owner') return SAT.ownerSkill;
  return (maker.skl || 0) * SAT.chefSkillPer + (maker.trait === 'kytinh' ? 0.05 : 0);
}

export function qualityOf(G, potId, maker) {
  const s = G.state, up = s.upgrades;
  const lvl = (s.recipes[potId] && s.recipes[potId].lvl) || 1;
  return SAT.baseQuality + (lvl - 1) * C.RECIPE.qualityPerLevel + makerBonus(G, maker) + up.stovetype * SAT.stoveQualityPer + up.knife * SAT.knifeQualityPer + perkFx(G).quality + mods(G).eqQuality;   // v2.6.9: hũ lắc, bồn rửa tay, máy ép ly
}

function waitBonus(ratio) {
  for (const [lim, b] of SAT.wait) if (ratio < lim) return b;
  return SAT.wait[SAT.wait.length - 1][1];
}

/** Compute the score/stars for a finished group `g` (g.info holds the served ticket facts). */
export function scoreGroup(G, g) {
  const s = G.state, up = s.upgrades, rng = G.rng;
  const k = C.CUSTOMERS[g.kind];
  const info = g.info || {};
  const potId = info.pot || g.pot;
  const quality = qualityOf(G, potId, info.maker);
  const amb = ambienceOf(G);
  const likes = !!k.likesAmbience;
  const ev = eventDef(G);
  const budget = k.budget * (ev && ev.budgetMult && g.kind === 'vanphong' ? ev.budgetMult : 1);
  const paid = (g.price != null ? g.price : sellPrice(G, potId)) * (info.priceMult || 1);
  const priceRatio = paid / budget;
  const over = paid / Math.max(1, potPrice(G, potId));     // vs the reference price: value for money
  const charm = charmBonus(G);
  const ingQ = info.ingQ || 0;                               // supplier quality (vựa sỉ −, nhà vườn +)
  let score = SAT.base + SAT.qualityWeight * (quality + ingQ - SAT.baseQuality);
  const P = C.PRICING;
  score += clamp((1 - over) * P.valueW, P.valueMin, P.valueMax);
  if (g.seated) score += C.SIDE.satBonus + (likes ? C.SIDE.ambienceBonus : 0);   // sat down to eat in comfort
  score -= C.SUPPLY_MISS_SAT * (g.supplyMiss || 0);
  score += perkFx(G).satBonus;                               // Ly in logo quán         // no bag / napkins / skewer
  const wRatio = info.waitRatio ?? 0.5;
  score += waitBonus(wRatio);
  score += SAT.ambienceWeight * amb * (likes ? 1.5 : 1);
  score += charm;
  score -= Math.min(SAT.pricePenaltyCap, SAT.pricePenalty * Math.max(0, priceRatio - 1));
  const hot = s.weather === 'hot' && up.cooling === 0;
  const uncoveredRain = (g.wet || 0) > 2;     // sat through part of a shower before the tarp came out
  if (hot) score += SAT.hotNoCooling;
  if (uncoveredRain) score += SAT.rainNoTarp;
  if (g.substitute) score -= SAT.substitutePenalty;
  score -= 0.3 * (g.extrasExpired || 0);
  if (info.shake) score += C.SHAKE.score[info.shake] || 0;
  score += (rng.next() * 2 - 1) * SAT.noise;
  const stars = clamp(Math.round(score), 1, 5);
  return { score, stars, f: { wRatio, quality: quality + ingQ, amb, likes, priceRatio, over, charm, hot, uncoveredRain } };
}

// ───────────── rating average ─────────────
export function pushRating(G, stars, copies = 1) {
  const r = G.state.rating;
  for (let i = 0; i < copies; i++) r.recent.push(stars);
  while (r.recent.length > C.RATING.window) r.recent.shift();
  r.count += 1;
  recomputeAvg(G);
}
export function recomputeAvg(G) {
  const r = G.state.rating;
  let sum = 0;
  for (let i = 0; i < r.recent.length; i++) sum += r.recent[i];
  r.avg = (sum + C.RATING.prior * C.RATING.priorWeight) / (r.recent.length + C.RATING.priorWeight);
}

// ───────────── reviews ─────────────
function tagFor(G, g, stars, f) {
  const k = C.CUSTOMERS[g.kind];
  const cand = [];
  const add = (tag, strength) => cand.push({ tag, strength });
  if (g.kind === 'chutu' && stars >= 3) add('regular', 1.2);
  if (g.kind === 'khachtay' && stars >= 4) add('tourist', 0.9);
  if (stars >= 4) {
    if (f.wRatio < C.COMBO.fastRatio) add('fast', 1);
    if (f.quality - SAT.baseQuality > 0.25) add('quality', 0.6);
    if (f.amb * (f.likes ? 1.5 : 1) > 0.5) add('ambience', 0.7);
    if (f.priceRatio < 0.7 || f.over < 0.85) add('cheap', f.over < 0.85 ? 0.9 : 0.6);
    if (G.state.weather === 'rain' && !f.uncoveredRain) add('rain', 0.5);
    if (G.state.weather === 'cold') add('cold', 0.5);
    if (f.charm > 0.15) add('staff', 0.4);
    if ((g.extrasServed || 0) > 0) add('extra', 0.5);
  } else {
    if (f.wRatio > 0.6) add('slow', 1);
    if (f.priceRatio > 1.1 || f.over > 1.25) add('pricey', f.over > 1.25 ? 1 : 0.7);
    if (f.hot) add('hot', 0.8);
    if (g.substitute) add('substitute', 0.8);
  }
  if (!cand.length) return null;
  cand.sort((a, b) => b.strength - a.strength);
  const lines = C.REVIEW_TEXT.tags[cand[0].tag];
  return lines ? G.rng.pick(lines) : null;
}

export function makeReview(G, g, stars, f, forcedText) {
  const s = G.state, rng = G.rng;
  const potId = (g.info && g.info.pot) || g.pot;
  const mon = POT[potId] ? POT[potId].name : 'Xoài lắc';
  let text = forcedText;
  if (!text) {
    text = rng.pick(C.REVIEW_TEXT[stars]);
    const tag = f ? tagFor(G, g, stars, f) : null;
    if (tag && (g.kind === 'chutu' || rng.chance(0.6))) text = g.kind === 'chutu' ? tag : text + ' ' + tag;
  }
  text = fill(text, { mon, quan: s.shopName });
  const names = C.REVIEW_NAMES_SPECIAL[g.kind] || C.REVIEW_NAMES;
  const review = { id: s.nextReviewId++, day: s.day, clock: Math.round(s.clock), kind: g.kind, name: rng.pick(names), stars, text, pot: potId || null, thanked: false };
  s.reviews.unshift(review);
  if (s.reviews.length > 60) s.reviews.length = 60;
  return review;
}

/** Pick a canned line for angry leavers by reason. */
export function angryLine(reason) {
  const pick = (arr, sub) => arr.find((t) => t.includes(sub));
  if (reason === 'stock') return pick(C.REVIEW_TEXT[2], 'hết hàng');
  if (reason === 'door') return pick(C.REVIEW_TEXT[1], 'Hết chỗ');
  if (reason === 'rain') return 'Mưa ướt hết cả người mà quán không che bạt gì hết, về thôi!';
  return pick(C.REVIEW_TEXT[1], 'Đợi') || null;
}
