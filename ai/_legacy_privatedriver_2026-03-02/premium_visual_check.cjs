const { chromium } = require('playwright');
const path = require('path');

const base = 'https://premium.private-driver.ro';
const outDir = path.resolve('ai/screenshots');

async function loginAndShot(browser, role, email, password, pagePath, fileName) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(800);

  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await Promise.all([
    page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);

  await page.goto(`${base}${pagePath}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: path.join(outDir, fileName), fullPage: true });
  await context.close();
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(outDir, 'premium-home-public.png'), fullPage: true });

  await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(outDir, 'premium-login.png'), fullPage: true });
  await context.close();

  await loginAndShot(browser, 'passenger', 'test.user@private-driver.ro', 'Rares102018', '/v2/passenger', 'premium-passenger-home.png');
  await loginAndShot(browser, 'driver', 'test.driver@private-driver.ro', 'Rares102018', '/v2/driver', 'premium-driver-home.png');
  await loginAndShot(browser, 'admin', 'test.admin@private-driver.ro', 'Rares102018', '/admin/settings', 'premium-admin-settings.png');

  await browser.close();
  console.log('Screenshots saved to', outDir);
})();
