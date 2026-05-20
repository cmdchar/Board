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
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Login failed ${email}: ${res.status} ${txt}`);
  }
  const json = await res.json();
  return {
    token: json?.data?.token,
    refreshToken: json?.data?.refresh_token,
    user: json?.data?.user,
  };
}

async function shotWithSession(browser, email, password, route, fileName) {
  const session = await apiLogin(email, password);
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate((s) => {
    localStorage.setItem('auth_token', s.token || '');
    localStorage.setItem('refresh_token', s.refreshToken || '');
    localStorage.setItem('user_data', JSON.stringify(s.user || {}));
    if (s.user?.id || s.user?._id) {
      localStorage.setItem('userId', s.user.id || s.user._id);
    }
  }, session);

  await page.goto(`${base}${route}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2200);
  await page.screenshot({ path: path.join(outDir, fileName), fullPage: true });
  await context.close();
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  await shotWithSession(browser, 'test.user@private-driver.ro', 'Rares102018', '/v2/passenger', 'premium-passenger-home-auth.png');
  await shotWithSession(browser, 'test.driver@private-driver.ro', 'Rares102018', '/v2/driver', 'premium-driver-home-auth.png');
  await shotWithSession(browser, 'test.admin@private-driver.ro', 'Rares102018', '/admin/settings', 'premium-admin-settings-auth.png');
  await browser.close();
  console.log('Auth screenshots generated');
})();
