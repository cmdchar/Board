const { chromium } = require('playwright');
const path = require('path');
const base = 'https://premium.private-driver.ro';
const outDir = path.resolve('ai/screenshots');

async function apiLogin(email, password) {
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Login failed ${email}: ${res.status} ${text}`);
  const json = JSON.parse(text);
  return { token: json?.data?.token, refreshToken: json?.data?.refresh_token, user: json?.data?.user };
}

async function dismissCookie(page) {
  const accept = page.locator('button:has-text("Accept toate")');
  if (await accept.count()) {
    await accept.first().click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(400);
  }
}

async function shot(role, email, route, fileName) {
  const session = await apiLogin(email, 'Rares102018');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    geolocation: { latitude: 44.4268, longitude: 26.1025 },
    permissions: ['geolocation'],
  });
  const page = await context.newPage();
  await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate((s) => {
    localStorage.setItem('auth_token', s.token || '');
    localStorage.setItem('refresh_token', s.refreshToken || '');
    localStorage.setItem('user_data', JSON.stringify(s.user || {}));
    if (s.user?.id || s.user?._id) localStorage.setItem('userId', s.user.id || s.user._id);
  }, session);
  await page.goto(`${base}${route}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await dismissCookie(page);
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2200);
  await page.screenshot({ path: path.join(outDir, fileName), fullPage: true });
  await context.close();
  await browser.close();
}

(async () => {
  await shot('passenger', 'test.user@private-driver.ro', '/v2/passenger', 'premium-passenger-home-ready.png');
  await shot('driver', 'test.driver@private-driver.ro', '/v2/driver', 'premium-driver-home-ready.png');
  console.log('Ready screenshots generated');
})();
