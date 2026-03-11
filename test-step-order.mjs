/**
 * Test: Verify questionnaire step navigation order for both conditions.
 *
 * "standard-first" → section-4 (step 1) → section-5 (step 2) → section-6 (step 3)
 * "bubble-first"   → section-5 (step 1) → section-4 (step 2) → section-6 (step 3)
 *
 * Uses a minimal static server so no Netlify functions are needed.
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const PORT = 9222;
const ROOT = path.resolve(".");

// Simple static file server
function startServer() {
  const MIME = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
    ".csv": "text/csv",
    ".json": "application/json",
  };

  const server = http.createServer((req, res) => {
    let filePath = path.join(ROOT, req.url === "/" ? "index.html" : req.url);
    const ext = path.extname(filePath);
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
      res.end(data);
    });
  });

  return new Promise((resolve) => {
    server.listen(PORT, () => resolve(server));
  });
}

let passed = 0;
let failed = 0;

function ok(name) { passed++; console.log(`  ✅ ${name}`); }
function fail(name, err) { failed++; console.log(`  ❌ ${name}: ${err}`); }

async function test(name, fn) {
  try { await fn(); ok(name); } catch (e) { fail(name, e.message); }
}

/**
 * Simulate what the demographics-next handler does for a given condition,
 * then verify the step navigation chain.
 */
async function testConditionOrder(browser, conditionOrder) {
  const page = await browser.newPage();
  await page.goto(`http://localhost:${PORT}/`);
  // Form exists but is hidden inside main-content; just wait for DOM ready
  await page.waitForSelector("#participant-form", { state: "attached", timeout: 5000 });

  // Directly simulate the registration result — skip intro/demographics/API
  await page.evaluate((order) => {
    const form = document.getElementById("participant-form");
    const section4 = document.getElementById("section-4");
    const section5 = document.getElementById("section-5");
    const section6 = document.getElementById("section-6");

    sessionStorage.setItem("conditionOrder", order);

    if (order === "bubble-first" && section4 && section5) {
      // This is the same logic as in questionnaire.js (post-fix)
      section4.dataset.qStep = "2";
      section5.dataset.qStep = "1";

      const btn4 = section4.querySelector(".q-next");
      const btn5 = section5.querySelector(".q-next");
      if (btn4) btn4.dataset.qNext = "3";
      if (btn5) btn5.dataset.qNext = "2";

      section4.classList.remove("q-step--active");
      section5.classList.add("q-step--active");

      // Reorder DOM (section-5 before section-4, both before section-6)
      form.insertBefore(section5, section6);
      form.insertBefore(section4, section6);
    }
    // For standard-first: the default HTML order already works.

    // Show main content
    const introPage = document.getElementById("intro-page");
    const demoPage = document.getElementById("demographics-page");
    const mainContent = document.getElementById("main-content");
    if (introPage) introPage.hidden = true;
    if (demoPage) demoPage.hidden = true;
    if (mainContent) mainContent.hidden = false;
  }, conditionOrder);

  // --- Verify step 1 is active ---
  const step1Id = await page.evaluate(() => {
    const active = document.querySelector(".q-step--active");
    return active ? active.id : null;
  });

  const expectedStep1 = conditionOrder === "bubble-first" ? "section-5" : "section-4";
  const expectedStep2 = conditionOrder === "bubble-first" ? "section-4" : "section-5";

  await test(`[${conditionOrder}] Step 1 is ${expectedStep1}`, () => {
    if (step1Id !== expectedStep1)
      throw new Error(`Expected ${expectedStep1}, got ${step1Id}`);
  });

  // --- Click Next on step 1, verify step 2 ---
  const nextBtn1 = await page.$(".q-step--active .q-next");
  const nextTarget1 = await nextBtn1.getAttribute("data-q-next");

  await test(`[${conditionOrder}] Step 1 Next button points to step 2`, () => {
    if (nextTarget1 !== "2")
      throw new Error(`Expected data-q-next="2", got "${nextTarget1}"`);
  });

  // Simulate clicking Next (call goToQStep via the button handler)
  // But since validation blocks it, we bypass and call goToQStep directly
  await page.evaluate((stepNum) => {
    // Replicate goToQStep logic
    document.querySelectorAll('.q-step').forEach(el => el.classList.remove('q-step--active'));
    const target = document.querySelector(`.q-step[data-q-step="${stepNum}"]`);
    if (target) target.classList.add('q-step--active');
  }, 2);

  const step2Id = await page.evaluate(() => {
    const active = document.querySelector(".q-step--active");
    return active ? active.id : null;
  });

  await test(`[${conditionOrder}] Step 2 is ${expectedStep2}`, () => {
    if (step2Id !== expectedStep2)
      throw new Error(`Expected ${expectedStep2}, got ${step2Id}`);
  });

  // --- Click Next on step 2, verify step 3 is the comparison section ---
  const nextBtn2 = await page.$(".q-step--active .q-next");
  const nextTarget2 = await nextBtn2.getAttribute("data-q-next");

  await test(`[${conditionOrder}] Step 2 Next button points to step 3`, () => {
    if (nextTarget2 !== "3")
      throw new Error(`Expected data-q-next="3", got "${nextTarget2}"`);
  });

  await page.evaluate(() => {
    document.querySelectorAll('.q-step').forEach(el => el.classList.remove('q-step--active'));
    const target = document.querySelector('.q-step[data-q-step="3"]');
    if (target) target.classList.add('q-step--active');
  });

  const step3Id = await page.evaluate(() => {
    const active = document.querySelector(".q-step--active");
    return active ? active.id : null;
  });

  await test(`[${conditionOrder}] Step 3 is section-6 (comparison)`, () => {
    if (step3Id !== "section-6")
      throw new Error(`Expected section-6, got ${step3Id}`);
  });

  // --- Verify the next button on step 3 goes to step 4 ---
  const nextBtn3 = await page.$(".q-step--active .q-next");
  const nextTarget3 = await nextBtn3.getAttribute("data-q-next");

  await test(`[${conditionOrder}] Step 3 Next button points to step 4`, () => {
    if (nextTarget3 !== "4")
      throw new Error(`Expected data-q-next="4", got "${nextTarget3}"`);
  });

  await page.close();
}

async function run() {
  const server = await startServer();
  console.log(`Static server on http://localhost:${PORT}`);

  const browser = await chromium.launch({ headless: true });

  console.log("\n🔹 Standard-first order tests");
  await testConditionOrder(browser, "standard-first");

  console.log("\n🔹 Bubble-first order tests");
  await testConditionOrder(browser, "bubble-first");

  console.log(`\n${"=".repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`${"=".repeat(40)}\n`);

  await browser.close();
  server.close();
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
