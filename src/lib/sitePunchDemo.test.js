import { describe, expect, it } from 'bun:test';
import { createSitePunchDemo } from './sitePunchDemo';
import { sendDemoSms } from '../../supabase/functions/send-sms/demo';

describe('worker punch demo', () => {
  it('uses today’s 0700–1900 Chicago sample shift and simulated GPS', () => {
    const demo = createSitePunchDemo(new Date('2026-11-25T21:12:00Z'));
    expect(demo.info.first_name).toBe('Demo');
    expect(demo.info.location_name).toBe('Demo Site — Sample Location');
    expect(demo.info.address).toBe('123 Main St, Houston, TX');
    expect(demo.info.shift_start).toBe('2026-11-25T13:00:00.000Z');
    expect(demo.info.shift_end).toBe('2026-11-26T01:00:00.000Z');
    expect(demo.intent('in').lat).toBe(29.76);
  });
  it('rejects non-admin demo sends without any provider call', async () => {
    let calls = 0;
    const result = await sendDemoSms({ recipientPhone: '2815550123' }, 'manager', { siteUrl: 'https://fairfieldrg.com' }, async () => { calls++; return new Response('{}'); });
    expect(result.status).toBe(403);
    expect(calls).toBe(0);
  });
  it('uses the exact demo SMS body and only the existing Twilio send path', async () => {
    const calls = [];
    const result = await sendDemoSms({ recipientPhone: '(281) 555-0123', content: 'ignored' }, 'admin', { siteUrl: 'https://fairfieldrg.com/', accountSid: 'test', authToken: 'test', from: '+12815550124' }, async (url, init) => { calls.push({ url, init }); return new Response('{}'); });
    expect(result.status).toBe(200);
    expect(calls.length).toBe(1);
    expect(calls[0].url).toBe('https://api.twilio.com/2010-04-01/Accounts/test/Messages.json');
    expect(calls[0].init.body.get('Body')).toBe('Fairfield clock-in DEMO (nothing is saved): https://fairfieldrg.com/punch/demo');
    expect(calls[0].init.body.get('To')).toBe('+12815550123');
  });
  it('invalid demo phone makes zero provider calls', async () => {
    let calls = 0;
    const result = await sendDemoSms({ recipientPhone: '123' }, 'admin', { siteUrl: 'https://fairfieldrg.com' }, async () => { calls++; return new Response('{}'); });
    expect(result.status).toBe(400);
    expect(calls).toBe(0);
  });
  it('public demo route completes in/out, late/early and Spanish with zero backend calls or punch storage', async () => {
    const script = `import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width":390,"height":844})
        await context.add_init_script("navigator.geolocation.getCurrentPosition = () => { throw new Error('Demo requested GPS'); };")
        page = await context.new_page()
        calls, errors = [], []
        async def reject_backend(route):
            calls.append(route.request.url)
            await route.abort()
        await context.route('**/*.supabase.co/**', reject_backend)
        page.on('pageerror', lambda e: errors.append(str(e)))
        screenshots = Path('/tmp/browser/punch-demo/screenshots')
        screenshots.mkdir(parents=True, exist_ok=True)
        async def sign():
            canvas = page.locator('canvas')
            await canvas.wait_for()
            box = await canvas.bounding_box()
            assert box
            await page.mouse.move(box['x']+40, box['y']+80)
            await page.mouse.down()
            await page.mouse.move(box['x']+170, box['y']+140, steps=12)
            await page.mouse.up()
            await page.get_by_role('button', name='Save', exact=True).click()
            await page.get_by_role('heading', name='Checked in', exact=False).wait_for()
        for mode in ['', '?late=1', '?early=1']:
            await page.goto('http://localhost:8080/punch/demo'+mode)
            await page.get_by_role('heading', name='Hi Demo!').wait_for()
            await page.get_by_role('button', name="I'M HERE — CHECK IN", exact=True).click()
            if mode == '?late=1':
                await page.get_by_role('button', name='Traffic', exact=True).click()
                await page.get_by_role('button', name='Clock in', exact=True).click()
            elif mode == '?early=1':
                await page.get_by_role('button', name='CHECK IN EARLY', exact=True).click()
                await page.get_by_role('button', name='Other', exact=True).click()
                await page.get_by_role('textbox', name='Early check-in reason').fill('Demo reason')
                await page.get_by_role('button', name='Record early check-in', exact=True).click()
            await sign()
            await page.screenshot(path=str(screenshots / ('in'+str(len(mode))+'.png')))
            await page.get_by_role('button', name='CHECK OUT', exact=True).click()
            await page.get_by_role('heading', name='Checked out', exact=False).wait_for()
        await page.get_by_role('button', name='ES', exact=True).click()
        await page.get_by_role('heading', name='Salida registrada', exact=False).wait_for()
        await page.screenshot(path=str(screenshots / 'out-es.png'))
        await page.wait_for_timeout(1100)
        keys = await page.evaluate("Object.keys(localStorage).filter(k => k.startsWith('site-punch'))")
        assert not keys, 'Demo wrote punch storage: '+str(keys)
        assert not calls, 'Demo called backend: '+str(calls)
        assert not errors, 'Page errors: '+str(errors)
        print('PASS: in/out, late/early, ES, zero backend calls, zero punch storage, zero GPS prompts')
        await browser.close()

asyncio.run(main())`;
    const proc = Bun.spawn(['python3', '-c', script], { stdout: 'pipe', stderr: 'pipe' });
    const [stdout, stderr, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
    if (code !== 0) throw new Error(`${stdout}\n${stderr}`);
    expect(stdout).toContain('PASS:');
  }, 120_000);
});