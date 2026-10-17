// Scene art tables (hand-written by Art-B; the PNGs are made by tools/art/bg.py).
//   file   PNG in /assets (EMPTY daytime background, 2 sprite px per world px)
//   x, y   world position of the PNG's top-left corner (the PNG is core + margins)
//   thumb  world rect [x, y, w, h] used for the 3:2 shop-card thumbnail
//   counters  vendor base sprites (gánh / xe đẩy / sạp két / tủ kính) under the prep trays, cycled per built stove
//   props  static decor drawn y-sorted: k = props.png frame, x/y = foot (bottom-centre) in world px
//   lights night light pools {x, y, r, c}: c = 'warm' | 'cool'
//   cool   upgrade positions the layout schema has no slot for: ceil (market umbrellas over the carts, top = y), mist (misting fans, foot)
//   art    [l, t, r, b] sprite-px rect of the PNG that holds real painted art; everything outside it is the PNG's baked
//          stretch margin, which scenes.js replaces with a mirror-tiled continuation of the outer band
//   fill   colour for anything beyond the extended PNG
export default {
  vihe: {
    file: 'scenes/vihe.png', art: [1, 1, 406, 446], x: -30, y: -32, w: 408, h: 448, thumb: [0, 0, 144, 96], fill: '#8a7aa0',
    counters: ['cart_ganh', 'cart_xe'],
    props: [
      { k: 'chalk', x: 26, y: 134 }, { k: 'cat', x: 88, y: 139 }, { k: 'crates', x: 6, y: 106 },
      { k: 'lamp2', x: 3, y: 140 }, { k: 'lamp2', x: 141, y: 140 },
    ],
    lights: [{ x: 3, y: 117, r: 34, c: 'warm' }, { x: 141, y: 117, r: 34, c: 'warm' }, { x: 72, y: 50, r: 44, c: 'warm' }],
    cool: { ceil: [{ x: 61, y: 18 }], mist: [{ x: 136, y: 84 }] },
  },
  hem: {
    file: 'scenes/hem.png', art: [1, 1, 498, 530], x: -37, y: -51, w: 500, h: 532, thumb: [0, 0, 176, 117], fill: '#8d7e8f',
    counters: ['cart_ganh', 'cart_ket', 'cart_xe'],
    props: [
      { k: 'chalk', x: 26, y: 100 }, { k: 'cat', x: 20, y: 172 }, { k: 'bin', x: 6, y: 178 }, { k: 'crates', x: 166, y: 180 },
      { k: 'lamp2', x: 172, y: 182 },
    ],
    lights: [{ x: 172, y: 159, r: 34, c: 'warm' }, { x: 56, y: 56, r: 42, c: 'warm' }, { x: 108, y: 56, r: 22, c: 'warm' }],
    cool: { ceil: [{ x: 56, y: 28 }], mist: [{ x: 170, y: 96 }] },
  },
  mapho: {
    file: 'scenes/mapho.png', art: [1, 1, 594, 664], x: -53, y: -74, w: 596, h: 666, thumb: [0, 0, 192, 128], fill: '#8878a0',
    counters: ['cart_kinh', 'cart_xe', 'cart_kinh', 'cart_ganh'],
    props: [
      { k: 'menuboard', x: 142, y: 188 }, { k: 'cat', x: 30, y: 186 }, { k: 'bin', x: 188, y: 188 },
      { k: 'lamp2', x: 3, y: 203 }, { k: 'lamp2', x: 189, y: 203 },
    ],
    lights: [{ x: 3, y: 180, r: 34, c: 'warm' }, { x: 189, y: 180, r: 34, c: 'warm' },
      { x: 44, y: 48, r: 40, c: 'warm' }, { x: 96, y: 48, r: 44, c: 'warm' }, { x: 148, y: 48, r: 40, c: 'warm' }],
    cool: { ceil: [{ x: 49, y: 28 }, { x: 93, y: 28 }], mist: [{ x: 186, y: 96 }] },
  },
  haitang: {
    file: 'scenes/haitang.png', art: [1, 1, 506, 908], x: -19, y: -75, w: 508, h: 910, thumb: [0, 110, 192, 128], fill: '#8a7aa4',
    counters: ['cart_kinh', 'cart_ket', 'cart_xe', 'cart_ganh', 'cart_kinh'],
    props: [
      { k: 'menuboard', x: 142, y: 314 }, { k: 'cat', x: 168, y: 318 }, { k: 'bin', x: 190, y: 322 },
      { k: 'lamp2', x: 3, y: 334 }, { k: 'lamp2', x: 189, y: 334 },
    ],
    lights: [{ x: 3, y: 311, r: 34, c: 'warm' }, { x: 189, y: 311, r: 34, c: 'warm' },
      { x: 50, y: 206, r: 40, c: 'warm' }, { x: 96, y: 206, r: 44, c: 'warm' }, { x: 142, y: 206, r: 40, c: 'warm' },
      { x: 50, y: 62, r: 36, c: 'warm' }, { x: 96, y: 62, r: 36, c: 'warm' }, { x: 142, y: 62, r: 36, c: 'warm' }],
    cool: { ceil: [{ x: 47, y: 171 }, { x: 102, y: 171 }, { x: 59, y: 42 }, { x: 105, y: 42 }], mist: [{ x: 140, y: 252 }, { x: 150, y: 72 }] },
  },
};
