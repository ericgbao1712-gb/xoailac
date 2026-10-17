// "Phố đêm Sài Gòn" palette — shared by all art and mirrored as CSS tokens in style.css.
// Art may ADD colours (keep the total under ~48) but must not change the values of the
// UI keys marked (ui) without updating style.css :root tokens too.
// Rule of taste: outlines use ink/ink2 (never pure black); highlights use cream (never pure white).

export const PAL = {
  // darks / outlines
  ink: '#2a1b2d',      // (ui) main outline + text
  ink2: '#4b2f45',     // (ui) secondary outline, shadows on light surfaces
  ink3: '#6e4a5e',     // soft shadow
  // warm neutrals
  bark: '#6b4430',
  wood: '#9c6a3c',
  wood2: '#c8935a',
  sand: '#e6c28c',
  paper2: '#f3dcb4',   // (ui) panel secondary
  paper: '#fdf3e1',    // (ui) panel base
  cream: '#fffaf0',    // highlights, steam
  // reds (stools, chili, lanterns, luck)
  red3: '#7e1f33',
  red2: '#b62f3a',     // (ui) primary button shadow
  red: '#e2433b',      // (ui) primary — red plastic stool
  coral: '#f2775a',
  pink: '#ff9eae',
  // golds (money, string lights, chicken broth)
  gold3: '#b8641e',
  gold2: '#e08e2b',    // (ui) currency shadow
  gold: '#f6b83c',     // (ui) currency
  gold1: '#ffdc7a',    // light bulbs glow core
  // greens (vegetables, plants, positive)
  leaf3: '#24493a',
  leaf2: '#357049',
  leaf: '#4c9a4a',     // (ui) positive
  lime: '#9cc94a',
  // jade / teal (signage, tiles, confirm)
  jade2: '#1d5f66',    // (ui)
  jade: '#2f9a8a',     // (ui) confirm / info
  mint: '#86d4bf',
  // blues (sky, night, rain)
  sky: '#9fdcf0',
  sky2: '#5fb2df',
  dusk: '#ff9a6a',
  dusk2: '#c25e77',
  night: '#2c3a6b',
  night2: '#1c2347',   // (ui) page backdrop
  // street greys (slightly purple)
  stone3: '#3e3850',
  stone2: '#5a5268',
  stone: '#8d8399',
  stone1: '#c3b9c4',
};

// Soup surface colours per broth key (HOTPOTS[].broth). [surface, darker ring, highlight]
export const BROTH = {
  ga:      ['#f2c14e', '#c98f2a', '#fff0b0'],
  nam:     ['#c9a26b', '#8f6a3c', '#ecd3a4'],
  thai:    ['#f0703a', '#b8401f', '#ffb58a'],
  bo:      ['#9a5a34', '#653620', '#d29a6a'],
  rieucua: ['#e8823c', '#a8522a', '#ffd08a'],
  chuacay: ['#d8362f', '#8e1e26', '#ff8a6e'],
  dacbiet: ['#e9a23b', '#9a4a26', '#ffe08a'],
};

// Skin / hair ramps for character variety (art picks by index from Look)
export const SKIN = [
  ['#f6d2b8', '#d9a88a'], ['#eebf9a', '#c99470'], ['#d9a274', '#ad7650'], ['#b77a52', '#8a5638'], ['#8c5a3c', '#643e29'],
];
export const HAIR = [
  ['#2a1b2d', '#4b2f45'], ['#4a2c22', '#6e4232'], ['#7a4a2a', '#a06a3c'], ['#c8935a', '#e6c28c'], ['#b62f3a', '#e2433b'], ['#c3b9c4', '#fffaf0'],
];
