/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const BASE_URL = "https://x.private-driver.ro";
const PASSWORD = "Rares102018";

const ACCOUNTS = {
  user: "test.user@private-driver.ro",
  driver: "test.driver@private-driver.ro",
  support: "test.support@private-driver.ro",
  admin: "test.admin@private-driver.ro",
};

const runId = `ui-${Date.now().toString(36)}`;
const artifactDir = path.join(process.cwd(), "test-results");
fs.mkdirSync(artifactDir, { recursive: true });

function safeName(input) {
  return String(input).replace(/[^a-z0-9-_]+/gi, "_").toLowerCase();
}

async function apiRequest(method, endpoint, token, body) {
  const headers = { "Content-Type": "application/json" };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = { raw: await response.text() };
  }

  return { status: response.status, payload };
}

async function login(email) {
  const { status, payload } = await apiRequest("POST", "/api/auth/login", null, {
    email,
    password: PASSWORD,
  });
  if (
    status !== 200 ||
    !payload?.success ||
    !payload?.data?.token ||
    !payload?.data?.user
  ) {
    throw new Error(`Login failed for ${email}: HTTP ${status} ${JSON.stringify(payload)}`);
  }
  return {
    token: payload.data.token,
    refreshToken: payload.data.refresh_token || null,
    user: payload.data.user,
  };
}

async function createConversation(token, participantIds, title, rideId) {
  const { status, payload } = await apiRequest("POST", "/api/conversations", token, {
    participantIds,
    title,
    ride_id: rideId,
  });
  const conversationId = payload?.data?.conversation?.id || payload?.data?.id || null;
  if (status !== 200 || !conversationId) {
    throw new Error(`createConversation failed: HTTP ${status} ${JSON.stringify(payload)}`);
  }
  return conversationId;
}

async function sendApiMessage(token, conversationId, content) {
  const { status, payload } = await apiRequest(
    "POST",
    `/api/conversations/${conversationId}/messages`,
    token,
    { content, type: "text" }
  );
  if (status !== 200) {
    throw new Error(`sendApiMessage failed: HTTP ${status} ${JSON.stringify(payload)}`);
  }
}

async function createSupportTicket(token, title, description, priority) {
  const { status, payload } = await apiRequest("POST", "/api/support/tickets", token, {
    title,
    description,
    category: "technical",
    priority,
  });
  const ticketId = payload?.data?.id || null;
  const ticketNumber = payload?.data?.ticket_number || null;
  if (status !== 200 || !ticketId || !ticketNumber) {
    throw new Error(`createSupportTicket failed: HTTP ${status} ${JSON.stringify(payload)}`);
  }
  return { ticketId, ticketNumber };
}

async function getSupportTicket(token, ticketId) {
  const { status, payload } = await apiRequest(
    "GET",
    `/api/support/tickets/${ticketId}`,
    token
  );
  const data = payload?.data || payload;
  const conversationId = data?.conversation_id || data?.conversationId || null;
  if (status !== 200 || !conversationId) {
    throw new Error(`getSupportTicket failed: HTTP ${status} ${JSON.stringify(payload)}`);
  }
  return { conversationId };
}

async function closeSupportTicket(token, ticketId) {
  await apiRequest("PUT", `/api/support/tickets/${ticketId}/status`, token, {
    status: "closed",
  });
}

async function bootstrapRolePage(browser, auth, route) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ token, refreshToken, user }) => {
      localStorage.setItem("auth_token", token);
      localStorage.setItem("user_data", JSON.stringify(user));
      localStorage.setItem("userId", user.id || user._id || "");
      if (refreshToken) {
        localStorage.setItem("refresh_token", refreshToken);
      }
    },
    {
      token: auth.token,
      refreshToken: auth.refreshToken,
      user: auth.user,
    }
  );
  await page.goto(`${BASE_URL}${route}`, { waitUntil: "domcontentloaded" });
  return { context, page };
}

async function openConversationFromMessagesPage(page, route, title) {
  await page.goto(`${BASE_URL}${route}`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Messages" }).waitFor({ timeout: 20000 });

  const searchInputs = page.locator('input[placeholder="Search conversations..."]');
  const inputCount = await searchInputs.count();
  if (inputCount === 0) {
    throw new Error("No search input found on messages page");
  }

  await searchInputs.nth(inputCount - 1).fill(title);
  const conversationButton = page.locator("button", { hasText: title }).first();
  await conversationButton.waitFor({ timeout: 20000 });
  await conversationButton.click();
  await page.locator('textarea[placeholder="Type your message..."]').waitFor({ timeout: 20000 });
}

async function sendUiMessage(page, text) {
  const textarea = page.locator('textarea[placeholder="Type your message..."]').first();
  await textarea.fill(text);
  await textarea.press("Enter");
  await page.getByText(text, { exact: true }).waitFor({ timeout: 20000 });
}

async function expectMessageVisible(page, text) {
  await page.getByText(text, { exact: true }).waitFor({ timeout: 20000 });
}

async function openSupportConversationById(page, conversationId) {
  await page.goto(`${BASE_URL}/support/messages/${conversationId}`, {
    waitUntil: "domcontentloaded",
  });
  await page.locator('textarea[placeholder="Type your message..."]').waitFor({ timeout: 20000 });
}

async function openSupportTicketDetail(page, ticketTitle) {
  await page.goto(`${BASE_URL}/support/tickets`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Support Tickets" }).waitFor({ timeout: 20000 });
  const search = page.getByPlaceholder("Search tickets...");
  await search.fill(ticketTitle);
  const ticketButton = page.locator("button", { hasText: ticketTitle }).first();
  await ticketButton.waitFor({ timeout: 20000 });
  await ticketButton.click();
  await page.locator('textarea[placeholder="Type your message..."]').waitFor({ timeout: 20000 });
}

async function main() {
  const checks = [];
  const cleanupTickets = [];
  const screenshots = [];

  async function runCheck(name, fn, pageForScreenshot) {
    try {
      await fn();
      checks.push({ name, ok: true });
    } catch (error) {
      let screenshotPath = null;
      if (pageForScreenshot) {
        screenshotPath = path.join(artifactDir, `${safeName(runId)}-${safeName(name)}.png`);
        try {
          await pageForScreenshot.screenshot({ path: screenshotPath, fullPage: true });
          screenshots.push(screenshotPath);
        } catch {
          screenshotPath = null;
        }
      }
      checks.push({
        name,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        screenshot: screenshotPath,
      });
    }
  }

  const auth = {};
  for (const role of Object.keys(ACCOUNTS)) {
    auth[role] = await login(ACCOUNTS[role]);
  }

  const userDriverTitle = `UI-UD-${runId}`;
  const userSupportTitle = `UI-US-${runId}`;
  const driverSupportTitle = `UI-DS-${runId}`;

  const convUserDriver = await createConversation(
    auth.user.token,
    [auth.driver.user.id],
    userDriverTitle,
    `ride-ui-ud-${runId}`
  );
  const convUserSupport = await createConversation(
    auth.user.token,
    [auth.support.user.id],
    userSupportTitle,
    `ride-ui-us-${runId}`
  );
  const convDriverSupport = await createConversation(
    auth.driver.token,
    [auth.support.user.id],
    driverSupportTitle,
    `ride-ui-ds-${runId}`
  );

  const userTicket = await createSupportTicket(
    auth.user.token,
    `UI Ticket User ${runId}`,
    "UI messaging audit ticket from passenger",
    "medium"
  );
  const userTicketDetail = await getSupportTicket(auth.user.token, userTicket.ticketId);
  cleanupTickets.push(userTicket.ticketId);

  const driverTicket = await createSupportTicket(
    auth.driver.token,
    `UI Ticket Driver ${runId}`,
    "UI messaging audit ticket from driver",
    "high"
  );
  const driverTicketDetail = await getSupportTicket(auth.driver.token, driverTicket.ticketId);
  cleanupTickets.push(driverTicket.ticketId);

  await sendApiMessage(
    auth.user.token,
    userTicketDetail.conversationId,
    `[seed-user-ticket-${runId}] initial user ticket message`
  );
  await sendApiMessage(
    auth.driver.token,
    driverTicketDetail.conversationId,
    `[seed-driver-ticket-${runId}] initial driver ticket message`
  );

  const browser = await chromium.launch({ headless: true });

  const userSession = await bootstrapRolePage(browser, auth.user, "/v2/passenger/messages");
  const driverSession = await bootstrapRolePage(browser, auth.driver, "/v2/driver/messages");
  const supportSession = await bootstrapRolePage(browser, auth.support, "/support/messages");

  const userPage = userSession.page;
  const driverPage = driverSession.page;
  const supportPage = supportSession.page;

  const msgUserToDriver = `[UI U->D ${runId}] Salut din UI passenger`;
  const msgDriverToUser = `[UI D->U ${runId}] Confirm din UI driver`;
  const msgUserToSupport = `[UI U->S ${runId}] Mesaj direct catre support`;
  const msgSupportToUser = `[UI S->U ${runId}] Reply support catre user`;
  const msgDriverToSupport = `[UI D->S ${runId}] Mesaj direct catre support`;
  const msgSupportToDriver = `[UI S->D ${runId}] Reply support catre driver`;
  const msgSupportInUserTicket = `[UI S ticket->U ${runId}] Reply in ticket user`;
  const msgSupportInDriverTicket = `[UI S ticket->D ${runId}] Reply in ticket driver`;

  await runCheck(
    "ui_user_driver_user_sends",
    async () => {
      await openConversationFromMessagesPage(userPage, "/v2/passenger/messages", userDriverTitle);
      await sendUiMessage(userPage, msgUserToDriver);
    },
    userPage
  );

  await runCheck(
    "ui_user_driver_driver_receives_and_replies",
    async () => {
      await openConversationFromMessagesPage(driverPage, "/v2/driver/messages", userDriverTitle);
      await expectMessageVisible(driverPage, msgUserToDriver);
      await sendUiMessage(driverPage, msgDriverToUser);
    },
    driverPage
  );

  await runCheck(
    "ui_user_driver_user_receives_reply",
    async () => {
      await openConversationFromMessagesPage(userPage, "/v2/passenger/messages", userDriverTitle);
      await expectMessageVisible(userPage, msgDriverToUser);
    },
    userPage
  );

  await runCheck(
    "ui_user_support_user_sends_direct",
    async () => {
      await openConversationFromMessagesPage(userPage, "/v2/passenger/messages", userSupportTitle);
      await sendUiMessage(userPage, msgUserToSupport);
    },
    userPage
  );

  await runCheck(
    "ui_user_support_support_receives_and_replies",
    async () => {
      await openSupportConversationById(supportPage, convUserSupport);
      await expectMessageVisible(supportPage, msgUserToSupport);
      await sendUiMessage(supportPage, msgSupportToUser);
    },
    supportPage
  );

  await runCheck(
    "ui_user_support_user_receives_reply",
    async () => {
      await openConversationFromMessagesPage(userPage, "/v2/passenger/messages", userSupportTitle);
      await expectMessageVisible(userPage, msgSupportToUser);
    },
    userPage
  );

  await runCheck(
    "ui_driver_support_driver_sends_direct",
    async () => {
      await openConversationFromMessagesPage(driverPage, "/v2/driver/messages", driverSupportTitle);
      await sendUiMessage(driverPage, msgDriverToSupport);
    },
    driverPage
  );

  await runCheck(
    "ui_driver_support_support_receives_and_replies",
    async () => {
      await openSupportConversationById(supportPage, convDriverSupport);
      await expectMessageVisible(supportPage, msgDriverToSupport);
      await sendUiMessage(supportPage, msgSupportToDriver);
    },
    supportPage
  );

  await runCheck(
    "ui_driver_support_driver_receives_reply",
    async () => {
      await openConversationFromMessagesPage(driverPage, "/v2/driver/messages", driverSupportTitle);
      await expectMessageVisible(driverPage, msgSupportToDriver);
    },
    driverPage
  );

  await runCheck(
    "ui_ticket_user_support_reply",
    async () => {
      await openSupportTicketDetail(supportPage, `UI Ticket User ${runId}`);
      await sendUiMessage(supportPage, msgSupportInUserTicket);
      await openConversationFromMessagesPage(
        userPage,
        "/v2/passenger/messages",
        `Support ${userTicket.ticketNumber}`
      );
      await expectMessageVisible(userPage, msgSupportInUserTicket);
    },
    supportPage
  );

  await runCheck(
    "ui_ticket_driver_support_reply",
    async () => {
      await openSupportTicketDetail(supportPage, `UI Ticket Driver ${runId}`);
      await sendUiMessage(supportPage, msgSupportInDriverTicket);
      await openConversationFromMessagesPage(
        driverPage,
        "/v2/driver/messages",
        `Support ${driverTicket.ticketNumber}`
      );
      await expectMessageVisible(driverPage, msgSupportInDriverTicket);
    },
    supportPage
  );

  for (const ticketId of cleanupTickets) {
    await closeSupportTicket(auth.support.token, ticketId);
  }

  await userSession.context.close();
  await driverSession.context.close();
  await supportSession.context.close();
  await browser.close();

  const passed = checks.filter((c) => c.ok).length;
  const summary = {
    runId,
    baseUrl: BASE_URL,
    passed,
    total: checks.length,
    checks,
    screenshots,
    ticketIds: cleanupTickets,
    seeded: {
      userDriverConversationId: convUserDriver,
      userSupportConversationId: convUserSupport,
      driverSupportConversationId: convDriverSupport,
      userTicketNumber: userTicket.ticketNumber,
      driverTicketNumber: driverTicket.ticketNumber,
    },
  };

  console.log(JSON.stringify(summary, null, 2));
  process.exit(passed === checks.length ? 0 : 1);
}

main().catch((error) => {
  console.error("Fatal UI messaging audit error:", error);
  process.exit(1);
});

