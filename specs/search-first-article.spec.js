const { startTimer, reportTransaction } = require('../utils/performance');

const SEARCH_TERM = 'BrowserStack';

describe('Wikipedia search', () => {
  it('searches BrowserStack and opens the first article', async () => {
    const skipButton = await $('id=org.wikipedia.alpha:id/fragment_onboarding_skip_button');
    await skipButton.waitForDisplayed({ timeout: 30000 });
    await skipButton.click();

    const searchCard = await $('id=org.wikipedia.alpha:id/search_container');
    await searchCard.waitForDisplayed({ timeout: 15000 });
    const startTime = startTimer();
    await searchCard.click();

    const searchInput = await $('id=org.wikipedia.alpha:id/search_src_text');
    await searchInput.waitForDisplayed({ timeout: 10000 });
    await searchInput.setValue(SEARCH_TERM);

    const resultsList = await $('id=org.wikipedia.alpha:id/search_results_list');
    await resultsList.waitForDisplayed({ timeout: 15000 });

    await browser.waitUntil(
      async () => (await $$('id=org.wikipedia.alpha:id/page_list_item_title')).length > 0,
      { timeout: 15000, timeoutMsg: 'No search results were displayed' }
    );

    const titles = await $$('id=org.wikipedia.alpha:id/page_list_item_title');
    expect(titles.length).toBeGreaterThan(0);
    const firstTitleText = await titles[0].getText();
    expect(firstTitleText.trim().length).toBeGreaterThan(0);

    await titles[0].click();

    const toolbar = await $('id=org.wikipedia.alpha:id/page_toolbar');
    await toolbar.waitForDisplayed({ timeout: 20000 });
    await expect(toolbar).toBeDisplayed();

    const pageActions = await $('id=org.wikipedia.alpha:id/page_actions_tab_layout');
    await pageActions.waitForDisplayed({ timeout: 20000 });
    await expect(pageActions).toBeDisplayed();
    const metric = await reportTransaction('search-to-article', startTime, {
      searchTerm: SEARCH_TERM,
    });
    console.log(`Search Transaction Time: ${metric.durationMs} ms (${metric.durationSec} s)`);

    await expect(resultsList).not.toExist();
  });
});
