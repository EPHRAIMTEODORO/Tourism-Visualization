import { chromium } from "playwright";

const BASE = "http://localhost:8888";
let browser, context, page;
let passed = 0;
let failed = 0;

function ok(name) { passed++; console.log(`  ✅ ${name}`); }
function fail(name, err) { failed++; console.log(`  ❌ ${name}: ${err}`); }

async function test(name, fn) {
  try { await fn(); ok(name); } catch (e) { fail(name, e.message); }
}

async function run() {
  browser = await chromium.launch({ headless: true });
  context = await browser.newContext();

  // ==============================
  // 1. ADMIN PAGE TESTS
  // ==============================
  console.log("\n🔹 Admin Page Tests");

  page = await context.newPage();
  await page.goto(`${BASE}/admin`);

  await test("Admin login page loads", async () => {
    await page.waitForSelector("#login-screen", { timeout: 5000 });
    const visible = await page.isVisible("#login-screen");
    if (!visible) throw new Error("Login screen not visible");
  });

  await test("Wrong password is rejected", async () => {
    await page.fill("#password-input", "wrongpass");
    await page.click("#login-btn");
    await page.waitForTimeout(1500);
    const error = await page.textContent("#login-error");
    if (!error.includes("Incorrect")) throw new Error(`Expected error, got: "${error}"`);
    const dashVisible = await page.isVisible("#dashboard");
    if (dashVisible) throw new Error("Dashboard should not be visible");
  });

  await test("Correct password shows dashboard", async () => {
    await page.fill("#password-input", "eisadmin1");
    await page.click("#login-btn");
    await page.waitForSelector("#dashboard", { state: "visible", timeout: 10000 });
    const visible = await page.isVisible("#dashboard");
    if (!visible) throw new Error("Dashboard not visible after login");
  });

  await test("Generate 50 tokens", async () => {
    await page.click("#seed-btn");
    await page.waitForTimeout(3000);
    const rows = await page.$$("#token-body tr");
    if (rows.length < 50) throw new Error(`Expected >=50 tokens, got ${rows.length}`);
    console.log(`    (Generated ${rows.length} tokens)`);
  });

  await test("Stats show correct counts", async () => {
    const stats = await page.textContent("#stats");
    if (!stats.includes("Available:")) throw new Error(`Stats missing: "${stats}"`);
  });

  // Grab a token for the next tests
  const firstToken = await page.textContent("#token-body tr:first-child .token-code");
  const token = firstToken.trim();
  console.log(`    (Using token: ${token})`);

  await test("Memo field works", async () => {
    const memoInput = page.locator("#token-body tr:first-child .memo-input");
    await memoInput.fill("Test User");
    await page.waitForTimeout(1000); // debounce
    // Reload to verify persistence
    await page.fill("#password-input", "eisadmin1");
    await page.click("#login-btn");
    await page.waitForSelector("#dashboard", { state: "visible", timeout: 10000 });
    // Wait for tokens to reload
    await page.waitForTimeout(2000);
    const memoVal = await page.locator("#token-body tr:first-child .memo-input").inputValue();
    if (memoVal !== "Test User") throw new Error(`Memo not saved: "${memoVal}"`);
  });

  await page.close();

  // ==============================
  // 2. INTRO PAGE TOKEN VALIDATION
  // ==============================
  console.log("\n🔹 Intro Page Token Tests");

  page = await context.newPage();
  await page.goto(BASE);

  await test("Intro page loads with token input", async () => {
    await page.waitForSelector("#token-input", { timeout: 5000 });
    const visible = await page.isVisible("#token-input");
    if (!visible) throw new Error("Token input not visible");
  });

  await test("Begin Study button is disabled by default", async () => {
    const disabled = await page.getAttribute("#intro-begin", "disabled");
    if (disabled === null) throw new Error("Button should be disabled");
  });

  await test("Invalid token shows error", async () => {
    await page.fill("#token-input", "XXXXXX");
    await page.waitForTimeout(2000);
    const error = await page.textContent("#token-error");
    if (!error.includes("Invalid")) throw new Error(`Expected invalid error, got: "${error}"`);
    const disabled = await page.getAttribute("#intro-begin", "disabled");
    if (disabled === null) throw new Error("Button should still be disabled");
  });

  await test("Valid token enables Begin Study", async () => {
    await page.fill("#token-input", "");
    await page.fill("#token-input", token);
    await page.waitForTimeout(2000);
    const error = await page.textContent("#token-error");
    if (error.trim()) throw new Error(`Unexpected error: "${error}"`);
    const disabled = await page.getAttribute("#intro-begin", "disabled");
    if (disabled !== null) throw new Error("Button should be enabled");
    const cls = await page.getAttribute("#token-input", "class");
    if (!cls.includes("token-valid")) throw new Error("Input should have token-valid class");
  });

  await test("Begin Study navigates to demographics", async () => {
    await page.click("#intro-begin");
    await page.waitForTimeout(500);
    const introHidden = await page.getAttribute("#intro-page", "hidden");
    const demoVisible = await page.isVisible("#demographics-page");
    if (introHidden === null) throw new Error("Intro should be hidden");
    if (!demoVisible) throw new Error("Demographics should be visible");
  });

  // ==============================
  // 3. CONDITION ORDER TEST
  // ==============================
  console.log("\n🔹 Condition Order Tests");

  await test("Demographics form + register assigns condition order", async () => {
    // Fill demographics
    await page.click('input[name="age"][value="21–25"]');
    await page.click('input[name="major"][value="Other"]');
    await page.click('input[name="course"][value="No"]');
    await page.waitForTimeout(500);

    // Click Next
    await page.click("#demographics-next");
    await page.waitForTimeout(3000);

    const participantId = await page.evaluate(() => sessionStorage.getItem("participantId"));
    const conditionOrder = await page.evaluate(() => sessionStorage.getItem("conditionOrder"));

    if (!participantId) throw new Error("participantId not set");
    if (!conditionOrder) throw new Error("conditionOrder not set");

    const expectedOrder = Number(participantId) % 2 === 1 ? "standard-first" : "bubble-first";
    if (conditionOrder !== expectedOrder) {
      throw new Error(`ID=${participantId}, expected ${expectedOrder}, got ${conditionOrder}`);
    }
    console.log(`    (participantId=${participantId}, conditionOrder=${conditionOrder})`);
  });

  await page.close();

  // ==============================
  // 4. TOKEN MARKED AS USED
  // ==============================
  console.log("\n🔹 Token Usage Verification");

  page = await context.newPage();

  await test("Used token is rejected on second attempt", async () => {
    await page.goto(BASE);
    await page.waitForSelector("#token-input", { timeout: 5000 });
    await page.fill("#token-input", token);
    await page.waitForTimeout(2000);
    const error = await page.textContent("#token-error");
    if (!error.includes("already been used")) throw new Error(`Expected used error, got: "${error}"`);
    const disabled = await page.getAttribute("#intro-begin", "disabled");
    if (disabled === null) throw new Error("Button should be disabled for used token");
  });

  await test("Admin shows token as Used", async () => {
    await page.goto(`${BASE}/admin`);
    await page.fill("#password-input", "eisadmin1");
    await page.click("#login-btn");
    await page.waitForSelector("#dashboard", { state: "visible", timeout: 10000 });
    await page.waitForTimeout(2000);

    const firstBadge = await page.textContent("#token-body tr:first-child .badge");
    if (!firstBadge.includes("Used")) throw new Error(`Expected Used badge, got: "${firstBadge.trim()}"`);
    const stats = await page.textContent("#stats");
    if (!stats.includes("Used: 1")) throw new Error(`Expected Used: 1, got: "${stats}"`);
  });

  await page.close();

  // ==============================
  // SUMMARY
  // ==============================
  console.log(`\n${"=".repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`${"=".repeat(40)}\n`);

  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
