const assert = require('assert');
const util = require('util');
const { promisify } = require('util');
const { inspect } = require('util');
const pronotepy = require('pronotepy');
const ent = require('pronotepy').ent;
const logging = require('logging');
const request = require('request');
const { ThreadPoolExecutor } = require('concurrent.futures');
const { as_completed } = require('concurrent.futures');

class TestENT {
  static functions = [];

  static async setUpClass() {
    const functions = Object.entries(ent).filter(([name, func]) => {
      return (typeof func === 'function' && name !== 'pronote_hubeduconnect') ||
        func instanceof util.promisify;
    });
    this.functions = functions;
  }

  static async testFunctions() {
    const executor = new ThreadPoolExecutor({ maxWorkers: 10 });
    const futures = {};

    for (const [name, func] of this.functions) {
      const promisifiedFunc = promisify(func);
      futures[executor.submit(promisifiedFunc, 'username', 'password')] = name;
    }

    for await (const future of as_completed(futures)) {
      const funcName = futures[future];
      try {
        await future.result();
      } catch (error) {
        assert(error instanceof pronotepy.ENTLoginError || error instanceof request.exceptions.ConnectionError);
      }
    }
  }
}

if (require.main === module) {
  logging.debug('Testing');
  TestENT.setUpClass().then(() => {
    TestENT.testFunctions().catch((error) => {
      console.error(inspect(error, { depth: null }));
    });
  });
}
