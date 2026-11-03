#!/usr/bin/env python3
"""headless 截图：进入动画 / 登录页 / 主界面（电脑+手机）。用法: shots.py URL OUTDIR"""
import sys, asyncio
from playwright.async_api import async_playwright
URL, OUT = sys.argv[1], sys.argv[2]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
        for name, vp, mob in [("desktop", {"width": 1440, "height": 900}, False), ("mobile", {"width": 390, "height": 844}, True)]:
            ctx = await b.new_context(viewport=vp, device_scale_factor=2 if mob else 1, is_mobile=mob, has_touch=mob)
            pg = await ctx.new_page(); errs = []
            pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("console", lambda m: m.type == "error" and errs.append(m.text))
            await pg.goto(URL); await pg.wait_for_timeout(2300)
            await pg.screenshot(path=f"{OUT}/shot_intro_{name}.png")
            await pg.click("#skip"); await pg.wait_for_timeout(900)
            await pg.click("#tR"); await pg.fill("#aU", "agent007"); await pg.fill("#aP", "hunter22x")
            await pg.screenshot(path=f"{OUT}/shot_login_{name}.png")
            await pg.click("#aGo"); await pg.wait_for_timeout(14000)
            await pg.screenshot(path=f"{OUT}/shot_{name}.png")
            print(name, "mode:", await pg.evaluate("mode"), "events:", await pg.evaluate("EV.length"), "errors:", errs[:5])
            await ctx.close()
        await b.close()
asyncio.run(main())
