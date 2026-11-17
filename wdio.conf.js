exports.config = {
  user: process.env.BROWSERSTACK_USERNAME,
  key: process.env.BROWSERSTACK_ACCESS_KEY,

  hostname: 'hub.browserstack.com',

  services: [
    [
      'browserstack',
      {
        app: 'bs://3b46f3a1c5a5729...',
        buildIdentifier: '${BUILD_NUMBER}',
      },
    ],
  ],

  capabilities: [
    {
      platformName: 'Android',
      'bstack:options': {
        deviceName: 'Samsung Galaxy S22 Plus',
        osVersion: '12.0',
        projectName: 'Wikipedia',
        buildName: 'wikipedia-search-first-article',
        sessionName: 'search BrowserStack and open first article',
        debug: true,
        networkLogs: true,
      },
    },
  ],

  specs: ['./specs/*.js'],
  maxInstances: 1,
  exclude: [],

  logLevel: 'info',
  waitforTimeout: 10000,
  connectionRetryTimeout: 90000,
  connectionRetryCount: 3,

  reporters: ['spec'],
  framework: 'mocha',
  mochaOpts: {
    ui: 'bdd',
    timeout: 120000,
  },
};
