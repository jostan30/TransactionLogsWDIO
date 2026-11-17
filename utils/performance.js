const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(process.cwd(), 'performance');
const TERMINAL_LOG_MAX_BYTES = 2 * 1024 * 1024;

/**
 * Uploads a .txt/.json/.xml/.log file (max 2 MB) as the session's terminal log.
 * It shows under the "Other Logs" tab of the App Automate session.
 * Credentials come from the environment and are never written anywhere.
 */
async function uploadTerminalLog(filePath, sessionId) {
  const { size } = fs.statSync(filePath);
  if (size > TERMINAL_LOG_MAX_BYTES) {
    throw new Error(`Terminal log ${filePath} is ${size} bytes; the limit is ${TERMINAL_LOG_MAX_BYTES}`);
  }

  const auth = Buffer.from(
    `${process.env.BROWSERSTACK_USERNAME}:${process.env.BROWSERSTACK_ACCESS_KEY}`
  ).toString('base64');

  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(filePath)]), path.basename(filePath));

  const response = await fetch(
    `https://api-cloud.browserstack.com/app-automate/sessions/${sessionId}/terminallogs`,
    { method: 'POST', headers: { Authorization: `Basic ${auth}` }, body: form }
  );
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Terminal log upload failed: HTTP ${response.status} ${body}`);
  }
  console.log(`Terminal log upload response: ${body}`);
  return body;
}

function startTimer() {
  return performance.now();
}

/**
 * Builds the metric, writes it to performance/<name>.json, attaches that file
 * to the test in BrowserStack Test Reporting & Analytics, and annotates the
 * session with the same JSON.
 */
async function reportTransaction(name, startTime, extra = {}) {
  const durationMs = Number((performance.now() - startTime).toFixed(2));
  const metric = {
    transaction: name,
    durationMs,
    durationSec: Number((durationMs / 1000).toFixed(2)),
    sessionId: browser.sessionId,
    capturedAt: new Date().toISOString(),
    ...extra,
  };

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const fileName = `${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.json`;
  const filePath = path.join(OUTPUT_DIR, fileName);
  fs.writeFileSync(filePath, JSON.stringify(metric, null, 2));
  await browser.uploadAttachment(filePath);
  await uploadTerminalLog(filePath, browser.sessionId);

  const annotation = {
    action: 'annotate',
    arguments: { data: JSON.stringify(metric), level: 'info' },
  };
  await browser.execute(`browserstack_executor: ${JSON.stringify(annotation)}`);

  return metric;
}

module.exports = { startTimer, reportTransaction, uploadTerminalLog };
