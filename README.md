# Tracking a transaction and uploading it to BrowserStack terminal logs

This guide shows how to time a user transaction in a WebdriverIO test on
BrowserStack App Automate, and publish the result in three places:

| Where | How | Where to see it |
|---|---|---|
| Local file | `performance/<name>.json` | In the project |
| Test Reporting & Analytics | `browser.uploadAttachment(file)` | The test in the build report |
| Session terminal logs | REST `POST .../terminallogs` | Session, **Other Logs** tab |
| Session logs | `annotate` executor | Session text logs (info entry) |

The working example is `specs/search-first-article.spec.js` with
`utils/performance.js`. The transaction is "tap the search card, search for a
term, open the first result, article screen visible".

## Prerequisites

1. `@wdio/browserstack-service` **v9** (and the other `@wdio/*` packages and
   `webdriverio` on v9). `browser.uploadAttachment` does not exist in v8.
2. Node 18 or later (the helper uses the built-in `fetch`, `FormData`, `Blob`).
3. `BROWSERSTACK_USERNAME` and `BROWSERSTACK_ACCESS_KEY` set in the
   environment. They are read at run time and never written to a file.
4. `wdio.conf.js` uses the `browserstack` service, as in this project.

## Step 1: Decide where the transaction starts and ends

A transaction is the user-visible span you want to measure. Start the timer
immediately before the action that begins it, and stop it after the last
element that proves it finished.

- Start: just before `searchCard.click()`.
- End: after `page_toolbar` and `page_actions_tab_layout` are both displayed.

Do not put assertions you do not want timed, or setup steps such as skipping
onboarding, inside the span. The measured time includes WebDriver round-trips
to the cloud device and the waits in your test, so it is end-to-end
transaction time, not the app's own render time.

## Step 2: Start the timer

```js
const { startTimer, reportTransaction } = require('../utils/performance');

const startTime = startTimer();   // returns performance.now()
await searchCard.click();
```

## Step 3: Run the steps, with explicit waits

Use element waits (`waitForDisplayed`, `waitUntil`), never fixed sleeps, so the
span ends when the app is actually ready:

```js
await toolbar.waitForDisplayed({ timeout: 20000 });
await pageActions.waitForDisplayed({ timeout: 20000 });
```

## Step 4: Stop the timer and report

Call `reportTransaction` once the end condition is met:

```js
const metric = await reportTransaction('search-to-article', startTime, {
  searchTerm: SEARCH_TERM,        // optional extra fields
});
console.log(`Search Transaction Time: ${metric.durationMs} ms (${metric.durationSec} s)`);
```

`reportTransaction(name, startTime, extra)` in `utils/performance.js` does the
following, in order:

1. Computes `durationMs` and `durationSec` and builds the metric object
   (`transaction`, `durationMs`, `durationSec`, `sessionId`, `capturedAt`, plus
   your `extra` fields).
2. Writes it to `performance/<name>.json` (name is lower-cased and sanitised).
3. Attaches that file to the test with `browser.uploadAttachment(filePath)`.
4. **Uploads that file as a session terminal log** (Step 5).
5. Annotates the session with the same JSON through the `browserstack_executor`
   `annotate` action.

Example file content:

```json
{
  "transaction": "search-to-article",
  "durationMs": 10284.39,
  "durationSec": 10.28,
  "sessionId": "<session id>",
  "capturedAt": "2026-11-17T14:47:41.302Z",
  "searchTerm": "BrowserStack"
}
```

## Step 5: Upload the file to the session's terminal logs

BrowserStack accepts terminal logs per session through the Session API:

`POST https://api-cloud.browserstack.com/app-automate/sessions/{session_id}/terminallogs`

Rules from the BrowserStack docs:

- Supported formats: `.txt`, `.json`, `.xml`, `.log`.
- Maximum size: 2 MB.
- The Build API uploads terminal logs for all sessions in a build instead.
- Logs are kept for 30 days.

The helper `uploadTerminalLog(filePath, sessionId)`:

```js
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
```

Notes:

- The multipart field name is `file`. The BrowserStack docs do not state the
  field name; `file` was accepted by the API in this project's run.
- The session id is `browser.sessionId`, taken while the session is still open.
  Upload before the session ends.
- A failed upload throws, so the test fails loudly instead of silently losing
  the data. If you would rather not fail the test on an upload problem, catch
  the error around the call and log it.
- The helper is also exported, so you can upload any other log file:
  `await uploadTerminalLog('/path/to/run.log', browser.sessionId)`.

## Step 6: Run it

```bash
npm install
npm test
```

A successful upload prints a line like:

```
Terminal log upload response: {"error":"","message":"File was successfully uploaded!", ... ,"file_name":"search-to-article.json"}
```

## Step 7: View the results

1. Open the build link printed at the end of the run
   (`https://automation.browserstack.com/builds/...`).
2. Open the session.
3. Click the **Other Logs** tab to see the uploaded terminal log.
4. For the attachment, open the test in Test Reporting & Analytics.
5. The annotation appears as an info entry in the session's text logs.

## Adding another transaction

1. Pick a new name, for example `checkout-to-confirmation`.
2. Call `startTimer()` before the first action and
   `reportTransaction('checkout-to-confirmation', startTime)` after the last
   proof element.
3. Each name writes its own `performance/<name>.json` and uploads it as its own
   terminal log.

## Checks before trusting the numbers

- Run the same transaction several times; a single run on a shared cloud
  device varies. Compare averages or percentiles, not one value.
- Keep the start and end points identical between runs.
- Do not compare numbers across different devices or OS versions.
