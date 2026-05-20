const { chromium } = require('playwright');

async function loginApi(baseUrl, email, password) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    throw new Error(`Login failed: ${response.status}`);
  }
  return response.json();
}

async function run() {
  const baseUrl = 'https://x.private-driver.ro';
  const login = await loginApi(baseUrl, 'test.user@private-driver.ro', 'Rares102018');
  const token = login?.data?.token;
  const refreshToken = login?.data?.refresh_token || '';
  const user = login?.data?.user;
  if (!token || !user) throw new Error('Missing auth payload');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  await page.addInitScript(
    ({ token, refreshToken, user }) => {
      localStorage.setItem('auth_token', token);
      if (refreshToken) localStorage.setItem('refresh_token', refreshToken);
      localStorage.setItem('user_data', JSON.stringify(user));
    },
    { token, refreshToken, user }
  );

  await page.goto(`${baseUrl}/v2/passenger`, { waitUntil: 'networkidle' });

  const whereButton = page.locator('button:has-text("Unde mergem?")').first();
  const beforeUrl = page.url();
  const beforeCount = await whereButton.count();
  let clickError = '';
  if (beforeCount > 0) {
    try {
      await whereButton.click({ timeout: 5000 });
    } catch (err) {
      clickError = String(err);
    }
  }

  await page.waitForTimeout(1200);
  const afterUrl = page.url();
  const pickupCount = await page.locator('text=Pickup').count();
  const destinationCount = await page.locator('text=Destinație').count();

  console.log(`where_button_found=${beforeCount > 0}`);
  console.log(`click_error=${clickError ? 'yes' : 'no'}`);
  if (clickError) {
    console.log(`click_error_detail=${clickError.slice(0, 250)}`);
  }
  console.log(`url_before=${beforeUrl}`);
  console.log(`url_after=${afterUrl}`);
  console.log(`pickup_visible=${pickupCount > 0}`);
  console.log(`destination_visible=${destinationCount > 0}`);
  console.log(`console_error_count=${consoleErrors.length}`);

  await browser.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
