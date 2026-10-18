"""v2.6.23 browser test: two open copies of the game must never overwrite each other's save.
Run from web/: python3 -m http.server 8765, then: python3 tools/xoailac/two_tabs_test.py (needs Playwright + Chromium)."""
import asyncio
from playwright.async_api import async_playwright
SKIP = ['.in-skip','text=Mở quán thôi!','.in-skip','.tut-skip']
async def boot(pg):
  await pg.goto('http://localhost:8765/xoailac/'); await pg.wait_for_timeout(2500)
  for sel in SKIP:
    try: await pg.click(sel,timeout=900); await pg.wait_for_timeout(300)
    except Exception: pass
ST = "()=>{const s=JSON.parse(localStorage.getItem('xoai-lac/save/v1')); return [s.level, s.money]}"
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(); c=await b.new_context(viewport={'width':390,'height':844})
    A=await c.new_page(); errs=[]; A.on('pageerror',lambda e:errs.append(str(e)))
    await boot(A)
    await A.evaluate("()=>{const g=window.__game; g.state.tutorial={step:99,done:true}; g.act.debug.level(10); g.state.money=1000; window.__persist()}")
    print('1. A saved', await A.evaluate(ST))
    B=await c.new_page(); B.on('pageerror',lambda e:errs.append(str(e))); await boot(B)
    await A.wait_for_timeout(600)
    print('2. B opened; A covered?', await A.evaluate("()=>!!document.querySelector('#stale-ov')"), '| B covered?', await B.evaluate("()=>!!document.querySelector('#stale-ov')"))
    await B.evaluate("()=>{const g=window.__game; g.act.debug.level(20); g.state.money=50000; window.__persist()}")
    print('3. B saved', await B.evaluate(ST))
    await A.evaluate("()=>{window.__game.state.money=7; window.__persist()}")
    await A.wait_for_timeout(16000)
    print('4. after old A tries + 16 s of autosave', await B.evaluate(ST))
    await A.click('#stale-ov button'); await A.wait_for_timeout(3000)
    print('5. A tapped "Chơi ở đây":', await A.evaluate("()=>[window.__game.state.level, window.__game.state.money, !!document.querySelector('#stale-ov')]"), '| B covered now?', await B.evaluate("()=>!!document.querySelector('#stale-ov')"))
    print('6. backup in A encodes level', await A.evaluate("()=>window.__game.serialize().level"))
    print('errors', errs[:3])
    await b.close()
asyncio.run(main())
