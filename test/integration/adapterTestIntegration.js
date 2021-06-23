/* @copyright Itential, LLC 2019 (pre-modifications) */

// Set globals
/* global describe it log pronghornProps */
/* eslint no-unused-vars: warn */

// include required items for testing & logging
const assert = require('assert');
const fs = require('fs');
const mocha = require('mocha');
const path = require('path');
const winston = require('winston');
const { expect } = require('chai');
const { use } = require('chai');
const td = require('testdouble');

const anything = td.matchers.anything();

// stub and attemptTimeout are used throughout the code so set them here
let logLevel = 'none';
const stub = true;
const isRapidFail = false;
const isSaveMockData = false;
const attemptTimeout = 5000;

// these variables can be changed to run in integrated mode so easier to set them here
// always check these in with bogus data!!!
const host = 'replace.hostorip.here';
const username = 'username';
const password = 'password';
const protocol = 'http';
const port = 80;
const sslenable = false;
const sslinvalid = false;

// these are the adapter properties. You generally should not need to alter
// any of these after they are initially set up
global.pronghornProps = {
  pathProps: {
    encrypted: false
  },
  adapterProps: {
    adapters: [{
      id: 'Test-Adapter-Clear-Pass',
      type: 'AdapterClearPass',
      properties: {
        host,
        port,
        base_path: '/api',
        version: '',
        cache_location: 'none',
        encode_pathvars: true,
        save_metric: false,
        stub,
        protocol,
        authentication: {
          auth_method: 'no_authentication',
          username,
          password,
          token: '',
          invalid_token_error: 401,
          token_timeout: -1,
          token_cache: 'local',
          auth_field: 'header.headers.Authorization',
          auth_field_format: 'Basic {b64}{username}:{password}{/b64}',
          auth_logging: false,
          client_id: '',
          client_secret: '',
          grant_type: ''
        },
        healthcheck: {
          type: 'none',
          frequency: 60000,
          query_object: {}
        },
        throttle: {
          throttle_enabled: false,
          number_pronghorns: 1,
          sync_async: 'sync',
          max_in_queue: 1000,
          concurrent_max: 1,
          expire_timeout: 0,
          avg_runtime: 200,
          priorities: [
            {
              value: 0,
              percent: 100
            }
          ]
        },
        request: {
          number_redirects: 0,
          number_retries: 3,
          limit_retry_error: [0],
          failover_codes: [],
          attempt_timeout: attemptTimeout,
          global_request: {
            payload: {},
            uriOptions: {},
            addlHeaders: {},
            authData: {}
          },
          healthcheck_on_timeout: true,
          return_raw: true,
          archiving: false,
          return_request: false
        },
        proxy: {
          enabled: false,
          host: '',
          port: 1,
          protocol: 'http',
          username: '',
          password: ''
        },
        ssl: {
          ecdhCurve: '',
          enabled: sslenable,
          accept_invalid_cert: sslinvalid,
          ca_file: '',
          key_file: '',
          cert_file: '',
          secure_protocol: '',
          ciphers: ''
        },
        mongo: {
          host: '',
          port: 0,
          database: '',
          username: '',
          password: '',
          replSet: '',
          db_ssl: {
            enabled: false,
            accept_invalid_cert: false,
            ca_file: '',
            key_file: '',
            cert_file: ''
          }
        }
      }
    }]
  }
};

global.$HOME = `${__dirname}/../..`;

// set the log levels that Pronghorn uses, spam and trace are not defaulted in so without
// this you may error on log.trace calls.
const myCustomLevels = {
  levels: {
    spam: 6,
    trace: 5,
    debug: 4,
    info: 3,
    warn: 2,
    error: 1,
    none: 0
  }
};

// need to see if there is a log level passed in
process.argv.forEach((val) => {
  // is there a log level defined to be passed in?
  if (val.indexOf('--LOG') === 0) {
    // get the desired log level
    const inputVal = val.split('=')[1];

    // validate the log level is supported, if so set it
    if (Object.hasOwnProperty.call(myCustomLevels.levels, inputVal)) {
      logLevel = inputVal;
    }
  }
});

// need to set global logging
global.log = winston.createLogger({
  level: logLevel,
  levels: myCustomLevels.levels,
  transports: [
    new winston.transports.Console()
  ]
});

/**
 * Runs the common asserts for test
 */
function runCommonAsserts(data, error) {
  assert.equal(undefined, error);
  assert.notEqual(undefined, data);
  assert.notEqual(null, data);
  assert.notEqual(undefined, data.response);
  assert.notEqual(null, data.response);
}

/**
 * Runs the error asserts for the test
 */
function runErrorAsserts(data, error, code, origin, displayStr) {
  assert.equal(null, data);
  assert.notEqual(undefined, error);
  assert.notEqual(null, error);
  assert.notEqual(undefined, error.IAPerror);
  assert.notEqual(null, error.IAPerror);
  assert.notEqual(undefined, error.IAPerror.displayString);
  assert.notEqual(null, error.IAPerror.displayString);
  assert.equal(code, error.icode);
  assert.equal(origin, error.IAPerror.origin);
  assert.equal(displayStr, error.IAPerror.displayString);
}

/**
 * @function saveMockData
 * Attempts to take data from responses and place them in MockDataFiles to help create Mockdata.
 * Note, this was built based on entity file structure for Adapter-Engine 1.6.x
 * @param {string} entityName - Name of the entity saving mock data for
 * @param {string} actionName -  Name of the action saving mock data for
 * @param {string} descriptor -  Something to describe this test (used as a type)
 * @param {string or object} responseData - The data to put in the mock file.
 */
function saveMockData(entityName, actionName, descriptor, responseData) {
  // do not need to save mockdata if we are running in stub mode (already has mock data) or if told not to save
  if (stub || !isSaveMockData) {
    return false;
  }

  // must have a response in order to store the response
  if (responseData && responseData.response) {
    let data = responseData.response;

    // if there was a raw response that one is better as it is untranslated
    if (responseData.raw) {
      data = responseData.raw;

      try {
        const temp = JSON.parse(data);
        data = temp;
      } catch (pex) {
        // do not care if it did not parse as we will just use data
      }
    }

    try {
      const base = path.join(__dirname, `../../entities/${entityName}/`);
      const mockdatafolder = 'mockdatafiles';
      const filename = `mockdatafiles/${actionName}-${descriptor}.json`;

      if (!fs.existsSync(base + mockdatafolder)) {
        fs.mkdirSync(base + mockdatafolder);
      }

      // write the data we retrieved
      fs.writeFile(base + filename, JSON.stringify(data, null, 2), 'utf8', (errWritingMock) => {
        if (errWritingMock) throw errWritingMock;

        // update the action file to reflect the changes. Note: We're replacing the default object for now!
        fs.readFile(`${base}action.json`, (errRead, content) => {
          if (errRead) throw errRead;

          // parse the action file into JSON
          const parsedJson = JSON.parse(content);

          // The object update we'll write in.
          const responseObj = {
            type: descriptor,
            key: '',
            mockFile: filename
          };

          // get the object for method we're trying to change.
          const currentMethodAction = parsedJson.actions.find((obj) => obj.name === actionName);

          // if the method was not found - should never happen but...
          if (!currentMethodAction) {
            throw Error('Can\'t find an action for this method in the provided entity.');
          }

          // if there is a response object, we want to replace the Response object. Otherwise we'll create one.
          const actionResponseObj = currentMethodAction.responseObjects.find((obj) => obj.type === descriptor);

          // Add the action responseObj back into the array of response objects.
          if (!actionResponseObj) {
            // if there is a default response object, we want to get the key.
            const defaultResponseObj = currentMethodAction.responseObjects.find((obj) => obj.type === 'default');

            // save the default key into the new response object
            if (defaultResponseObj) {
              responseObj.key = defaultResponseObj.key;
            }

            // save the new response object
            currentMethodAction.responseObjects = [responseObj];
          } else {
            // update the location of the mock data file
            actionResponseObj.mockFile = responseObj.mockFile;
          }

          // Save results
          fs.writeFile(`${base}action.json`, JSON.stringify(parsedJson, null, 2), (err) => {
            if (err) throw err;
          });
        });
      });
    } catch (e) {
      log.debug(`Failed to save mock data for ${actionName}. ${e.message}`);
      return false;
    }
  }

  // no response to save
  log.debug(`No data passed to save into mockdata for ${actionName}`);
  return false;
}

// require the adapter that we are going to be using
const AdapterClearPass = require('../../adapter');

// begin the testing - these should be pretty well defined between the describe and the it!
describe('[integration] Adapter-Clear-Pass Adapter Test', () => {
  describe('AdapterClearPass Class Tests', () => {
    const a = new AdapterClearPass(
      pronghornProps.adapterProps.adapters[0].id,
      pronghornProps.adapterProps.adapters[0].properties
    );

    if (isRapidFail) {
      const state = {};
      state.passed = true;

      mocha.afterEach(function x() {
        state.passed = state.passed
        && (this.currentTest.state === 'passed');
      });
      mocha.beforeEach(function x() {
        if (!state.passed) {
          return this.currentTest.skip();
        }
        return true;
      });
    }

    describe('#class instance created', () => {
      it('should be a class with properties', (done) => {
        try {
          assert.notEqual(null, a);
          assert.notEqual(undefined, a);
          const checkId = global.pronghornProps.adapterProps.adapters[0].id;
          assert.equal(checkId, a.id);
          assert.notEqual(null, a.allProps);
          const check = global.pronghornProps.adapterProps.adapters[0].properties.healthcheck.type;
          assert.equal(check, a.healthcheckType);
          done();
        } catch (error) {
          log.error(`Test Failure: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    describe('#connect', () => {
      it('should get connected - no healthcheck', (done) => {
        try {
          a.healthcheckType = 'none';
          a.connect();

          try {
            assert.equal(true, a.alive);
            done();
          } catch (error) {
            log.error(`Test Failure: ${error}`);
            done(error);
          }
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      });
      it('should get connected - startup healthcheck', (done) => {
        try {
          a.healthcheckType = 'startup';
          a.connect();

          try {
            assert.equal(true, a.alive);
            done();
          } catch (error) {
            log.error(`Test Failure: ${error}`);
            done(error);
          }
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      });
    });

    describe('#healthCheck', () => {
      it('should be healthy', (done) => {
        try {
          a.healthCheck(null, (data) => {
            try {
              assert.equal(true, a.healthy);
              saveMockData('system', 'healthcheck', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    /*
    -----------------------------------------------------------------------
    -----------------------------------------------------------------------
    *** All code above this comment will be replaced during a migration ***
    ******************* DO NOT REMOVE THIS COMMENT BLOCK ******************
    -----------------------------------------------------------------------
    -----------------------------------------------------------------------
    */

    let staticHostListName = 'fakedata';
    let staticHostListStaticHostListId = 555;
    const staticHostListPostForStaticHostListBodyParam = {
      id: 9,
      name: 'string',
      description: 'string',
      host_format: 'subnet',
      host_type: 'MACAddress',
      value: 'string'
    };
    describe('#postForStaticHostList - errors', () => {
      it('should work if integrated or standalone with mockdata', (done) => {
        try {
          a.postForStaticHostList(staticHostListPostForStaticHostListBodyParam, (data, error) => {
            try {
              if (stub) {
                runCommonAsserts(data, error);
                assert.equal(3, data.response.id);
                assert.equal('string', data.response.name);
                assert.equal('string', data.response.description);
                assert.equal('list', data.response.host_format);
                assert.equal('MACAddress', data.response.host_type);
                assert.equal('string', data.response.value);
              } else {
                runCommonAsserts(data, error);
              }
              staticHostListName = data.response.name;
              staticHostListStaticHostListId = data.response.id;
              saveMockData('StaticHostList', 'postForStaticHostList', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    describe('#getForStaticHostList - errors', () => {
      it('should work if integrated or standalone with mockdata', (done) => {
        try {
          a.getForStaticHostList(null, null, null, null, null, (data, error) => {
            try {
              if (stub) {
                runCommonAsserts(data, error);
                assert.equal('object', typeof data.response._embedded);
                assert.equal('object', typeof data.response._links);
                assert.equal(5, data.response.count);
              } else {
                runCommonAsserts(data, error);
              }
              saveMockData('StaticHostList', 'getForStaticHostList', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    const staticHostListPutForStaticHostListByNameBodyParam = {
      id: 10,
      name: 'string',
      description: 'string',
      host_format: 'subnet',
      host_type: 'IPAddress',
      value: 'string'
    };
    describe('#putForStaticHostListByName - errors', () => {
      it('should work if integrated or standalone with mockdata', (done) => {
        try {
          a.putForStaticHostListByName(staticHostListName, staticHostListPutForStaticHostListByNameBodyParam, (data, error) => {
            try {
              if (stub) {
                runCommonAsserts(data, error);
                assert.equal('success', data.response);
              } else {
                runCommonAsserts(data, error);
              }
              saveMockData('StaticHostList', 'putForStaticHostListByName', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    const staticHostListPatchForStaticHostListByNameBodyParam = {
      id: 5,
      name: 'string',
      description: 'string',
      host_format: 'list',
      host_type: 'MACAddress',
      value: 'string'
    };
    describe('#patchForStaticHostListByName - errors', () => {
      it('should work if integrated or standalone with mockdata', (done) => {
        try {
          a.patchForStaticHostListByName(staticHostListName, staticHostListPatchForStaticHostListByNameBodyParam, (data, error) => {
            try {
              if (stub) {
                runCommonAsserts(data, error);
                assert.equal('success', data.response);
              } else {
                runCommonAsserts(data, error);
              }
              saveMockData('StaticHostList', 'patchForStaticHostListByName', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    describe('#getForStaticHostListByName - errors', () => {
      it('should work if integrated or standalone with mockdata', (done) => {
        try {
          a.getForStaticHostListByName(staticHostListName, (data, error) => {
            try {
              if (stub) {
                runCommonAsserts(data, error);
                assert.equal(4, data.response.id);
                assert.equal('string', data.response.name);
                assert.equal('string', data.response.description);
                assert.equal('subnet', data.response.host_format);
                assert.equal('IPAddress', data.response.host_type);
                assert.equal('string', data.response.value);
              } else {
                runCommonAsserts(data, error);
              }
              saveMockData('StaticHostList', 'getForStaticHostListByName', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    const staticHostListPutForStaticHostListBodyParam = {
      id: 2,
      name: 'string',
      description: 'string',
      host_format: 'subnet',
      host_type: 'IPAddress',
      value: 'string'
    };
    describe('#putForStaticHostList - errors', () => {
      it('should work if integrated or standalone with mockdata', (done) => {
        try {
          a.putForStaticHostList(staticHostListStaticHostListId, staticHostListPutForStaticHostListBodyParam, (data, error) => {
            try {
              if (stub) {
                runCommonAsserts(data, error);
                assert.equal('success', data.response);
              } else {
                runCommonAsserts(data, error);
              }
              saveMockData('StaticHostList', 'putForStaticHostList', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    const staticHostListPatchForStaticHostListBodyParam = {
      id: 10,
      name: 'string',
      description: 'string',
      host_format: 'regex',
      host_type: 'IPAddress',
      value: 'string'
    };
    describe('#patchForStaticHostList - errors', () => {
      it('should work if integrated or standalone with mockdata', (done) => {
        try {
          a.patchForStaticHostList(staticHostListStaticHostListId, staticHostListPatchForStaticHostListBodyParam, (data, error) => {
            try {
              if (stub) {
                runCommonAsserts(data, error);
                assert.equal('success', data.response);
              } else {
                runCommonAsserts(data, error);
              }
              saveMockData('StaticHostList', 'patchForStaticHostList', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    describe('#getGETForStaticHostList - errors', () => {
      it('should work if integrated or standalone with mockdata', (done) => {
        try {
          a.getGETForStaticHostList(staticHostListStaticHostListId, (data, error) => {
            try {
              if (stub) {
                runCommonAsserts(data, error);
                assert.equal(1, data.response.id);
                assert.equal('string', data.response.name);
                assert.equal('string', data.response.description);
                assert.equal('regex', data.response.host_format);
                assert.equal('IPAddress', data.response.host_type);
                assert.equal('string', data.response.value);
              } else {
                runCommonAsserts(data, error);
              }
              saveMockData('StaticHostList', 'getGETForStaticHostList', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    let roleName = 'fakedata';
    let roleRoleId = 555;
    const rolePostForRoleBodyParam = {
      id: 3,
      name: 'string',
      description: 'string'
    };
    describe('#postForRole - errors', () => {
      it('should work if integrated or standalone with mockdata', (done) => {
        try {
          a.postForRole(rolePostForRoleBodyParam, (data, error) => {
            try {
              if (stub) {
                runCommonAsserts(data, error);
                assert.equal(8, data.response.id);
                assert.equal('string', data.response.name);
                assert.equal('string', data.response.description);
              } else {
                runCommonAsserts(data, error);
              }
              roleName = data.response.name;
              roleRoleId = data.response.id;
              saveMockData('Role', 'postForRole', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    describe('#getForRole - errors', () => {
      it('should work if integrated or standalone with mockdata', (done) => {
        try {
          a.getForRole(null, null, null, null, null, (data, error) => {
            try {
              if (stub) {
                runCommonAsserts(data, error);
                assert.equal('object', typeof data.response._embedded);
                assert.equal('object', typeof data.response._links);
                assert.equal(1, data.response.count);
              } else {
                runCommonAsserts(data, error);
              }
              saveMockData('Role', 'getForRole', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    const rolePutForRoleByNameBodyParam = {
      id: 10,
      name: 'string',
      description: 'string'
    };
    describe('#putForRoleByName - errors', () => {
      it('should work if integrated or standalone with mockdata', (done) => {
        try {
          a.putForRoleByName(roleName, rolePutForRoleByNameBodyParam, (data, error) => {
            try {
              if (stub) {
                runCommonAsserts(data, error);
                assert.equal('success', data.response);
              } else {
                runCommonAsserts(data, error);
              }
              saveMockData('Role', 'putForRoleByName', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    const rolePatchForRoleByNameBodyParam = {
      id: 5,
      name: 'string',
      description: 'string'
    };
    describe('#patchForRoleByName - errors', () => {
      it('should work if integrated or standalone with mockdata', (done) => {
        try {
          a.patchForRoleByName(roleName, rolePatchForRoleByNameBodyParam, (data, error) => {
            try {
              if (stub) {
                runCommonAsserts(data, error);
                assert.equal('success', data.response);
              } else {
                runCommonAsserts(data, error);
              }
              saveMockData('Role', 'patchForRoleByName', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    describe('#getForRoleByName - errors', () => {
      it('should work if integrated or standalone with mockdata', (done) => {
        try {
          a.getForRoleByName(roleName, (data, error) => {
            try {
              if (stub) {
                runCommonAsserts(data, error);
                assert.equal(2, data.response.id);
                assert.equal('string', data.response.name);
                assert.equal('string', data.response.description);
              } else {
                runCommonAsserts(data, error);
              }
              saveMockData('Role', 'getForRoleByName', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    const rolePutForRoleBodyParam = {
      id: 4,
      name: 'string',
      description: 'string'
    };
    describe('#putForRole - errors', () => {
      it('should work if integrated or standalone with mockdata', (done) => {
        try {
          a.putForRole(roleRoleId, rolePutForRoleBodyParam, (data, error) => {
            try {
              if (stub) {
                runCommonAsserts(data, error);
                assert.equal('success', data.response);
              } else {
                runCommonAsserts(data, error);
              }
              saveMockData('Role', 'putForRole', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    const rolePatchForRoleBodyParam = {
      id: 6,
      name: 'string',
      description: 'string'
    };
    describe('#patchForRole - errors', () => {
      it('should work if integrated or standalone with mockdata', (done) => {
        try {
          a.patchForRole(roleRoleId, rolePatchForRoleBodyParam, (data, error) => {
            try {
              if (stub) {
                runCommonAsserts(data, error);
                assert.equal('success', data.response);
              } else {
                runCommonAsserts(data, error);
              }
              saveMockData('Role', 'patchForRole', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    describe('#getGETForRole - errors', () => {
      it('should work if integrated or standalone with mockdata', (done) => {
        try {
          a.getGETForRole(roleRoleId, (data, error) => {
            try {
              if (stub) {
                runCommonAsserts(data, error);
                assert.equal(8, data.response.id);
                assert.equal('string', data.response.name);
                assert.equal('string', data.response.description);
              } else {
                runCommonAsserts(data, error);
              }
              saveMockData('Role', 'getGETForRole', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    let localUserUserId = 'fakedata';
    let localUserLocalUserId = 555;
    const localUserPostForLocalUserBodyParam = {
      id: 10,
      user_id: 'string',
      password: 'string',
      username: 'string',
      role_name: 'string',
      enabled: false,
      change_pwd_next_login: false,
      attributes: {}
    };
    describe('#postForLocalUser - errors', () => {
      it('should work if integrated or standalone with mockdata', (done) => {
        try {
          a.postForLocalUser(localUserPostForLocalUserBodyParam, (data, error) => {
            try {
              if (stub) {
                runCommonAsserts(data, error);
                assert.equal(6, data.response.id);
                assert.equal('string', data.response.userId);
                assert.equal('string', data.response.password);
                assert.equal('string', data.response.username);
                assert.equal('string', data.response.role_name);
                assert.equal(true, data.response.enabled);
                assert.equal(true, data.response.change_pwd_next_login);
                assert.equal('object', typeof data.response.attributes);
              } else {
                runCommonAsserts(data, error);
              }
              localUserUserId = data.response.userId;
              localUserLocalUserId = data.response.id;
              saveMockData('LocalUser', 'postForLocalUser', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    describe('#getForLocalUser - errors', () => {
      it('should work if integrated or standalone with mockdata', (done) => {
        try {
          a.getForLocalUser(null, null, null, null, null, (data, error) => {
            try {
              if (stub) {
                runCommonAsserts(data, error);
                assert.equal('object', typeof data.response._embedded);
                assert.equal('object', typeof data.response._links);
                assert.equal(3, data.response.count);
              } else {
                runCommonAsserts(data, error);
              }
              saveMockData('LocalUser', 'getForLocalUser', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    const localUserPutForLocalUserPasswordPolicyBodyParam = {
      password_minimum_length: '1-128',
      password_complexity: 'CASE',
      password_disallowed_characters: 'string',
      password_disallowed_words: 'string',
      password_prohibit_user_id: true,
      password_prohibit_repeated_chars: false,
      password_expiry_days: '0-500',
      password_remember_history: '1-99',
      reminder_days: '1-365',
      reminder_message: 'string',
      disable_after_days: '1-1000',
      disable_after_date: 'yyyy-mm-dd',
      disable_after_unchanged_days: '1-365',
      disable_after_failed_attempts: '1-100',
      reset_failed_attempts_count: true
    };
    describe('#putForLocalUserPasswordPolicy - errors', () => {
      it('should work if integrated or standalone with mockdata', (done) => {
        try {
          a.putForLocalUserPasswordPolicy(localUserPutForLocalUserPasswordPolicyBodyParam, (data, error) => {
            try {
              if (stub) {
                runCommonAsserts(data, error);
                assert.equal('success', data.response);
              } else {
                runCommonAsserts(data, error);
              }
              saveMockData('LocalUser', 'putForLocalUserPasswordPolicy', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    const localUserPatchForLocalUserPasswordPolicyBodyParam = {
      password_minimum_length: '1-128',
      password_complexity: 'COMPLEX',
      password_disallowed_characters: 'string',
      password_disallowed_words: 'string',
      password_prohibit_user_id: true,
      password_prohibit_repeated_chars: false,
      password_expiry_days: '0-500',
      password_remember_history: '1-99',
      reminder_days: '1-365',
      reminder_message: 'string',
      disable_after_days: '1-1000',
      disable_after_date: 'yyyy-mm-dd',
      disable_after_unchanged_days: '1-365',
      disable_after_failed_attempts: '1-100',
      reset_failed_attempts_count: false
    };
    describe('#patchForLocalUserPasswordPolicy - errors', () => {
      it('should work if integrated or standalone with mockdata', (done) => {
        try {
          a.patchForLocalUserPasswordPolicy(localUserPatchForLocalUserPasswordPolicyBodyParam, (data, error) => {
            try {
              if (stub) {
                runCommonAsserts(data, error);
                assert.equal('success', data.response);
              } else {
                runCommonAsserts(data, error);
              }
              saveMockData('LocalUser', 'patchForLocalUserPasswordPolicy', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    describe('#getForLocalUserPasswordPolicy - errors', () => {
      it('should work if integrated or standalone with mockdata', (done) => {
        try {
          a.getForLocalUserPasswordPolicy((data, error) => {
            try {
              if (stub) {
                runCommonAsserts(data, error);
                assert.equal('1-128', data.response.password_minimum_length);
                assert.equal('COMPLEX', data.response.password_complexity);
                assert.equal('string', data.response.password_disallowed_characters);
                assert.equal('string', data.response.password_disallowed_words);
                assert.equal(true, data.response.password_prohibit_user_id);
                assert.equal(false, data.response.password_prohibit_repeated_chars);
                assert.equal('0-500', data.response.password_expiry_days);
                assert.equal('1-99', data.response.password_remember_history);
                assert.equal('1-365', data.response.reminder_days);
                assert.equal('string', data.response.reminder_message);
                assert.equal('1-1000', data.response.disable_after_days);
                assert.equal('yyyy-mm-dd', data.response.disable_after_date);
                assert.equal('1-365', data.response.disable_after_unchanged_days);
                assert.equal('1-100', data.response.disable_after_failed_attempts);
                assert.equal(true, data.response.reset_failed_attempts_count);
              } else {
                runCommonAsserts(data, error);
              }
              saveMockData('LocalUser', 'getForLocalUserPasswordPolicy', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    const localUserPutForLocalUserByUserIdBodyParam = {
      id: 4,
      user_id: 'string',
      password: 'string',
      username: 'string',
      role_name: 'string',
      enabled: true,
      change_pwd_next_login: true,
      attributes: {}
    };
    describe('#putForLocalUserByUserId - errors', () => {
      it('should work if integrated or standalone with mockdata', (done) => {
        try {
          a.putForLocalUserByUserId(localUserUserId, localUserPutForLocalUserByUserIdBodyParam, (data, error) => {
            try {
              if (stub) {
                runCommonAsserts(data, error);
                assert.equal('success', data.response);
              } else {
                runCommonAsserts(data, error);
              }
              saveMockData('LocalUser', 'putForLocalUserByUserId', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    const localUserPatchForLocalUserByUserIdBodyParam = {
      id: 3,
      user_id: 'string',
      password: 'string',
      username: 'string',
      role_name: 'string',
      enabled: true,
      change_pwd_next_login: false,
      attributes: {}
    };
    describe('#patchForLocalUserByUserId - errors', () => {
      it('should work if integrated or standalone with mockdata', (done) => {
        try {
          a.patchForLocalUserByUserId(localUserUserId, localUserPatchForLocalUserByUserIdBodyParam, (data, error) => {
            try {
              if (stub) {
                runCommonAsserts(data, error);
                assert.equal('success', data.response);
              } else {
                runCommonAsserts(data, error);
              }
              saveMockData('LocalUser', 'patchForLocalUserByUserId', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    describe('#getForLocalUserByUserId - errors', () => {
      it('should work if integrated or standalone with mockdata', (done) => {
        try {
          a.getForLocalUserByUserId(localUserUserId, (data, error) => {
            try {
              if (stub) {
                runCommonAsserts(data, error);
                assert.equal(3, data.response.id);
                assert.equal('string', data.response.userId);
                assert.equal('string', data.response.password);
                assert.equal('string', data.response.username);
                assert.equal('string', data.response.role_name);
                assert.equal(false, data.response.enabled);
                assert.equal(false, data.response.change_pwd_next_login);
                assert.equal('object', typeof data.response.attributes);
              } else {
                runCommonAsserts(data, error);
              }
              saveMockData('LocalUser', 'getForLocalUserByUserId', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    const localUserPutForLocalUserBodyParam = {
      id: 3,
      user_id: 'string',
      password: 'string',
      username: 'string',
      role_name: 'string',
      enabled: false,
      change_pwd_next_login: true,
      attributes: {}
    };
    describe('#putForLocalUser - errors', () => {
      it('should work if integrated or standalone with mockdata', (done) => {
        try {
          a.putForLocalUser(localUserLocalUserId, localUserPutForLocalUserBodyParam, (data, error) => {
            try {
              if (stub) {
                runCommonAsserts(data, error);
                assert.equal('success', data.response);
              } else {
                runCommonAsserts(data, error);
              }
              saveMockData('LocalUser', 'putForLocalUser', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    const localUserPatchForLocalUserBodyParam = {
      id: 7,
      user_id: 'string',
      password: 'string',
      username: 'string',
      role_name: 'string',
      enabled: false,
      change_pwd_next_login: true,
      attributes: {}
    };
    describe('#patchForLocalUser - errors', () => {
      it('should work if integrated or standalone with mockdata', (done) => {
        try {
          a.patchForLocalUser(localUserLocalUserId, localUserPatchForLocalUserBodyParam, (data, error) => {
            try {
              if (stub) {
                runCommonAsserts(data, error);
                assert.equal('success', data.response);
              } else {
                runCommonAsserts(data, error);
              }
              saveMockData('LocalUser', 'patchForLocalUser', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    describe('#getGETForLocalUser - errors', () => {
      it('should work if integrated or standalone with mockdata', (done) => {
        try {
          a.getGETForLocalUser(localUserLocalUserId, (data, error) => {
            try {
              if (stub) {
                runCommonAsserts(data, error);
                assert.equal(8, data.response.id);
                assert.equal('string', data.response.userId);
                assert.equal('string', data.response.password);
                assert.equal('string', data.response.username);
                assert.equal('string', data.response.role_name);
                assert.equal(false, data.response.enabled);
                assert.equal(true, data.response.change_pwd_next_login);
                assert.equal('object', typeof data.response.attributes);
              } else {
                runCommonAsserts(data, error);
              }
              saveMockData('LocalUser', 'getGETForLocalUser', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    let endpointMacAddress = 'fakedata';
    let endpointEndpointId = 555;
    const endpointPostForEndpointBodyParam = {
      id: 6,
      mac_address: 'string',
      description: 'string',
      status: 'Known',
      attributes: {}
    };
    describe('#postForEndpoint - errors', () => {
      it('should work if integrated or standalone with mockdata', (done) => {
        try {
          a.postForEndpoint(endpointPostForEndpointBodyParam, (data, error) => {
            try {
              if (stub) {
                runCommonAsserts(data, error);
                assert.equal(8, data.response.id);
                assert.equal('string', data.response.macAddress);
                assert.equal('string', data.response.description);
                assert.equal('Disabled', data.response.status);
                assert.equal('object', typeof data.response.attributes);
              } else {
                runCommonAsserts(data, error);
              }
              endpointMacAddress = data.response.macAddress;
              endpointEndpointId = data.response.id;
              saveMockData('Endpoint', 'postForEndpoint', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    describe('#getForEndpoint - errors', () => {
      it('should work if integrated or standalone with mockdata', (done) => {
        try {
          a.getForEndpoint(null, null, null, null, null, (data, error) => {
            try {
              if (stub) {
                runCommonAsserts(data, error);
                assert.equal('object', typeof data.response._embedded);
                assert.equal('object', typeof data.response._links);
                assert.equal(5, data.response.count);
              } else {
                runCommonAsserts(data, error);
              }
              saveMockData('Endpoint', 'getForEndpoint', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    const endpointPutForEndpointByMacAddressBodyParam = {
      id: 6,
      mac_address: 'string',
      description: 'string',
      status: 'Known',
      attributes: {}
    };
    describe('#putForEndpointByMacAddress - errors', () => {
      it('should work if integrated or standalone with mockdata', (done) => {
        try {
          a.putForEndpointByMacAddress(endpointMacAddress, endpointPutForEndpointByMacAddressBodyParam, (data, error) => {
            try {
              if (stub) {
                runCommonAsserts(data, error);
                assert.equal('success', data.response);
              } else {
                runCommonAsserts(data, error);
              }
              saveMockData('Endpoint', 'putForEndpointByMacAddress', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    const endpointPatchForEndpointByMacAddressBodyParam = {
      id: 1,
      mac_address: 'string',
      description: 'string',
      status: 'Known',
      attributes: {}
    };
    describe('#patchForEndpointByMacAddress - errors', () => {
      it('should work if integrated or standalone with mockdata', (done) => {
        try {
          a.patchForEndpointByMacAddress(endpointMacAddress, endpointPatchForEndpointByMacAddressBodyParam, (data, error) => {
            try {
              if (stub) {
                runCommonAsserts(data, error);
                assert.equal('success', data.response);
              } else {
                runCommonAsserts(data, error);
              }
              saveMockData('Endpoint', 'patchForEndpointByMacAddress', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    describe('#getForEndpointByMacAddress - errors', () => {
      it('should work if integrated or standalone with mockdata', (done) => {
        try {
          a.getForEndpointByMacAddress(endpointMacAddress, (data, error) => {
            try {
              if (stub) {
                runCommonAsserts(data, error);
                assert.equal(9, data.response.id);
                assert.equal('string', data.response.macAddress);
                assert.equal('string', data.response.description);
                assert.equal('Unknown', data.response.status);
                assert.equal('object', typeof data.response.attributes);
              } else {
                runCommonAsserts(data, error);
              }
              saveMockData('Endpoint', 'getForEndpointByMacAddress', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    const endpointPutForEndpointBodyParam = {
      id: 6,
      mac_address: 'string',
      description: 'string',
      status: 'Disabled',
      attributes: {}
    };
    describe('#putForEndpoint - errors', () => {
      it('should work if integrated or standalone with mockdata', (done) => {
        try {
          a.putForEndpoint(endpointEndpointId, endpointPutForEndpointBodyParam, (data, error) => {
            try {
              if (stub) {
                runCommonAsserts(data, error);
                assert.equal('success', data.response);
              } else {
                runCommonAsserts(data, error);
              }
              saveMockData('Endpoint', 'putForEndpoint', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    const endpointPatchForEndpointBodyParam = {
      id: 4,
      mac_address: 'string',
      description: 'string',
      status: 'Known',
      attributes: {}
    };
    describe('#patchForEndpoint - errors', () => {
      it('should work if integrated or standalone with mockdata', (done) => {
        try {
          a.patchForEndpoint(endpointEndpointId, endpointPatchForEndpointBodyParam, (data, error) => {
            try {
              if (stub) {
                runCommonAsserts(data, error);
                assert.equal('success', data.response);
              } else {
                runCommonAsserts(data, error);
              }
              saveMockData('Endpoint', 'patchForEndpoint', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    describe('#getGETForEndpoint - errors', () => {
      it('should work if integrated or standalone with mockdata', (done) => {
        try {
          a.getGETForEndpoint(endpointEndpointId, (data, error) => {
            try {
              if (stub) {
                runCommonAsserts(data, error);
                assert.equal(3, data.response.id);
                assert.equal('string', data.response.macAddress);
                assert.equal('string', data.response.description);
                assert.equal('Unknown', data.response.status);
                assert.equal('object', typeof data.response.attributes);
              } else {
                runCommonAsserts(data, error);
              }
              saveMockData('Endpoint', 'getGETForEndpoint', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    let proxyTargetName = 'fakedata';
    let proxyTargetProxyTargetId = 555;
    const proxyTargetPostForProxyTargetBodyParam = {
      id: 8,
      name: 'string',
      host_name: 'string',
      description: 'string',
      authentication_port: 5,
      accounting_port: 4,
      secret: 'string'
    };
    describe('#postForProxyTarget - errors', () => {
      it('should work if integrated or standalone with mockdata', (done) => {
        try {
          a.postForProxyTarget(proxyTargetPostForProxyTargetBodyParam, (data, error) => {
            try {
              if (stub) {
                runCommonAsserts(data, error);
                assert.equal(4, data.response.id);
                assert.equal('string', data.response.name);
                assert.equal('string', data.response.host_name);
                assert.equal('string', data.response.description);
                assert.equal(4, data.response.authentication_port);
                assert.equal(8, data.response.accounting_port);
                assert.equal('string', data.response.secret);
              } else {
                runCommonAsserts(data, error);
              }
              proxyTargetName = data.response.name;
              proxyTargetProxyTargetId = data.response.id;
              saveMockData('ProxyTarget', 'postForProxyTarget', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    describe('#getForProxyTarget - errors', () => {
      it('should work if integrated or standalone with mockdata', (done) => {
        try {
          a.getForProxyTarget(null, null, null, null, null, (data, error) => {
            try {
              if (stub) {
                runCommonAsserts(data, error);
                assert.equal('object', typeof data.response._embedded);
                assert.equal('object', typeof data.response._links);
                assert.equal(5, data.response.count);
              } else {
                runCommonAsserts(data, error);
              }
              saveMockData('ProxyTarget', 'getForProxyTarget', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    const proxyTargetPutForProxyTargetByNameBodyParam = {
      id: 7,
      name: 'string',
      host_name: 'string',
      description: 'string',
      authentication_port: 2,
      accounting_port: 1,
      secret: 'string'
    };
    describe('#putForProxyTargetByName - errors', () => {
      it('should work if integrated or standalone with mockdata', (done) => {
        try {
          a.putForProxyTargetByName(proxyTargetName, proxyTargetPutForProxyTargetByNameBodyParam, (data, error) => {
            try {
              if (stub) {
                runCommonAsserts(data, error);
                assert.equal('success', data.response);
              } else {
                runCommonAsserts(data, error);
              }
              saveMockData('ProxyTarget', 'putForProxyTargetByName', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    const proxyTargetPatchForProxyTargetByNameBodyParam = {
      id: 2,
      name: 'string',
      host_name: 'string',
      description: 'string',
      authentication_port: 6,
      accounting_port: 5,
      secret: 'string'
    };
    describe('#patchForProxyTargetByName - errors', () => {
      it('should work if integrated or standalone with mockdata', (done) => {
        try {
          a.patchForProxyTargetByName(proxyTargetName, proxyTargetPatchForProxyTargetByNameBodyParam, (data, error) => {
            try {
              if (stub) {
                runCommonAsserts(data, error);
                assert.equal('success', data.response);
              } else {
                runCommonAsserts(data, error);
              }
              saveMockData('ProxyTarget', 'patchForProxyTargetByName', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    describe('#getForProxyTargetByName - errors', () => {
      it('should work if integrated or standalone with mockdata', (done) => {
        try {
          a.getForProxyTargetByName(proxyTargetName, (data, error) => {
            try {
              if (stub) {
                runCommonAsserts(data, error);
                assert.equal(9, data.response.id);
                assert.equal('string', data.response.name);
                assert.equal('string', data.response.host_name);
                assert.equal('string', data.response.description);
                assert.equal(3, data.response.authentication_port);
                assert.equal(10, data.response.accounting_port);
                assert.equal('string', data.response.secret);
              } else {
                runCommonAsserts(data, error);
              }
              saveMockData('ProxyTarget', 'getForProxyTargetByName', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    const proxyTargetPutForProxyTargetBodyParam = {
      id: 9,
      name: 'string',
      host_name: 'string',
      description: 'string',
      authentication_port: 2,
      accounting_port: 6,
      secret: 'string'
    };
    describe('#putForProxyTarget - errors', () => {
      it('should work if integrated or standalone with mockdata', (done) => {
        try {
          a.putForProxyTarget(proxyTargetProxyTargetId, proxyTargetPutForProxyTargetBodyParam, (data, error) => {
            try {
              if (stub) {
                runCommonAsserts(data, error);
                assert.equal('success', data.response);
              } else {
                runCommonAsserts(data, error);
              }
              saveMockData('ProxyTarget', 'putForProxyTarget', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    const proxyTargetPatchForProxyTargetBodyParam = {
      id: 8,
      name: 'string',
      host_name: 'string',
      description: 'string',
      authentication_port: 10,
      accounting_port: 7,
      secret: 'string'
    };
    describe('#patchForProxyTarget - errors', () => {
      it('should work if integrated or standalone with mockdata', (done) => {
        try {
          a.patchForProxyTarget(proxyTargetProxyTargetId, proxyTargetPatchForProxyTargetBodyParam, (data, error) => {
            try {
              if (stub) {
                runCommonAsserts(data, error);
                assert.equal('success', data.response);
              } else {
                runCommonAsserts(data, error);
              }
              saveMockData('ProxyTarget', 'patchForProxyTarget', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    describe('#getGETForProxyTarget - errors', () => {
      it('should work if integrated or standalone with mockdata', (done) => {
        try {
          a.getGETForProxyTarget(proxyTargetProxyTargetId, (data, error) => {
            try {
              if (stub) {
                runCommonAsserts(data, error);
                assert.equal(10, data.response.id);
                assert.equal('string', data.response.name);
                assert.equal('string', data.response.host_name);
                assert.equal('string', data.response.description);
                assert.equal(10, data.response.authentication_port);
                assert.equal(9, data.response.accounting_port);
                assert.equal('string', data.response.secret);
              } else {
                runCommonAsserts(data, error);
              }
              saveMockData('ProxyTarget', 'getGETForProxyTarget', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    let networkDeviceName = 'fakedata';
    let networkDeviceNetworkDeviceId = 555;
    const networkDevicePostForNetworkDeviceBodyParam = {
      id: 7,
      description: 'string',
      name: 'string',
      ip_address: 'string',
      radius_secret: 'string',
      tacacs_secret: 'string',
      vendor_name: 'string',
      coa_capable: true,
      coa_port: 10,
      radsec_enabled: false,
      snmp_read: {
        force_read: false,
        read_arp_info: true,
        zone_name: 'string',
        snmp_version: 'V1',
        community_string: 'string',
        security_level: 'AUTH_NOPRIV',
        user: 'string',
        auth_protocol: 'MD5',
        auth_key: 'string',
        privacy_protocol: 'DES_CBC',
        privacy_key: 'string'
      },
      snmp_write: {
        default_vlan: 4,
        snmp_version: 'V1',
        community_string: 'string',
        security_level: 'AUTH_PRIV',
        user: 'string',
        auth_protocol: 'SHA',
        auth_key: 'string',
        privacy_protocol: 'AES_128',
        privacy_key: 'string'
      },
      cli_config: {
        type: 'Telnet',
        port: 4,
        username: 'string',
        password: 'string',
        username_prompt_regex: 'string',
        password_prompt_regex: 'string',
        command_prompt_regex: 'string',
        enable_prompt_regex: 'string',
        enable_password: 'string'
      },
      onConnect_enforcement: {
        enabled: true,
        ports: 'string'
      },
      attributes: {}
    };
    describe('#postForNetworkDevice - errors', () => {
      it('should work if integrated or standalone with mockdata', (done) => {
        try {
          a.postForNetworkDevice(networkDevicePostForNetworkDeviceBodyParam, (data, error) => {
            try {
              if (stub) {
                runCommonAsserts(data, error);
                assert.equal(10, data.response.id);
                assert.equal('string', data.response.description);
                assert.equal('string', data.response.name);
                assert.equal('string', data.response.ip_address);
                assert.equal('string', data.response.radius_secret);
                assert.equal('string', data.response.tacacs_secret);
                assert.equal('string', data.response.vendor_name);
                assert.equal(false, data.response.coa_capable);
                assert.equal(10, data.response.coa_port);
                assert.equal(false, data.response.radsec_enabled);
                assert.equal('object', typeof data.response.snmp_read);
                assert.equal('object', typeof data.response.snmp_write);
                assert.equal('object', typeof data.response.cli_config);
                assert.equal('object', typeof data.response.onConnect_enforcement);
                assert.equal('object', typeof data.response.attributes);
              } else {
                runCommonAsserts(data, error);
              }
              networkDeviceName = data.response.name;
              networkDeviceNetworkDeviceId = data.response.id;
              saveMockData('NetworkDevice', 'postForNetworkDevice', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    describe('#getForNetworkDevice - errors', () => {
      it('should work if integrated or standalone with mockdata', (done) => {
        try {
          a.getForNetworkDevice(null, null, null, null, null, (data, error) => {
            try {
              if (stub) {
                runCommonAsserts(data, error);
                assert.equal('object', typeof data.response._embedded);
                assert.equal('object', typeof data.response._links);
                assert.equal(3, data.response.count);
              } else {
                runCommonAsserts(data, error);
              }
              saveMockData('NetworkDevice', 'getForNetworkDevice', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    const networkDevicePutForNetworkDeviceByNameBodyParam = {
      id: 9,
      description: 'string',
      name: 'string',
      ip_address: 'string',
      radius_secret: 'string',
      tacacs_secret: 'string',
      vendor_name: 'string',
      coa_capable: false,
      coa_port: 4,
      radsec_enabled: true,
      snmp_read: {
        force_read: false,
        read_arp_info: true,
        zone_name: 'string',
        snmp_version: 'V3',
        community_string: 'string',
        security_level: 'AUTH_PRIV',
        user: 'string',
        auth_protocol: 'SHA',
        auth_key: 'string',
        privacy_protocol: 'DES_CBC',
        privacy_key: 'string'
      },
      snmp_write: {
        default_vlan: 10,
        snmp_version: 'V3',
        community_string: 'string',
        security_level: 'AUTH_NOPRIV',
        user: 'string',
        auth_protocol: 'SHA',
        auth_key: 'string',
        privacy_protocol: 'DES_CBC',
        privacy_key: 'string'
      },
      cli_config: {
        type: 'SSH',
        port: 10,
        username: 'string',
        password: 'string',
        username_prompt_regex: 'string',
        password_prompt_regex: 'string',
        command_prompt_regex: 'string',
        enable_prompt_regex: 'string',
        enable_password: 'string'
      },
      onConnect_enforcement: {
        enabled: false,
        ports: 'string'
      },
      attributes: {}
    };
    describe('#putForNetworkDeviceByName - errors', () => {
      it('should work if integrated or standalone with mockdata', (done) => {
        try {
          a.putForNetworkDeviceByName(networkDeviceName, networkDevicePutForNetworkDeviceByNameBodyParam, (data, error) => {
            try {
              if (stub) {
                runCommonAsserts(data, error);
                assert.equal('success', data.response);
              } else {
                runCommonAsserts(data, error);
              }
              saveMockData('NetworkDevice', 'putForNetworkDeviceByName', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    const networkDevicePatchForNetworkDeviceByNameBodyParam = {
      id: 7,
      description: 'string',
      name: 'string',
      ip_address: 'string',
      radius_secret: 'string',
      tacacs_secret: 'string',
      vendor_name: 'string',
      coa_capable: false,
      coa_port: 3,
      radsec_enabled: false,
      snmp_read: {
        force_read: false,
        read_arp_info: false,
        zone_name: 'string',
        snmp_version: 'V3',
        community_string: 'string',
        security_level: 'NOAUTH_NOPRIV',
        user: 'string',
        auth_protocol: 'SHA',
        auth_key: 'string',
        privacy_protocol: 'DES_CBC',
        privacy_key: 'string'
      },
      snmp_write: {
        default_vlan: 4,
        snmp_version: 'V1',
        community_string: 'string',
        security_level: 'AUTH_PRIV',
        user: 'string',
        auth_protocol: 'MD5',
        auth_key: 'string',
        privacy_protocol: 'AES_128',
        privacy_key: 'string'
      },
      cli_config: {
        type: 'Telnet',
        port: 1,
        username: 'string',
        password: 'string',
        username_prompt_regex: 'string',
        password_prompt_regex: 'string',
        command_prompt_regex: 'string',
        enable_prompt_regex: 'string',
        enable_password: 'string'
      },
      onConnect_enforcement: {
        enabled: true,
        ports: 'string'
      },
      attributes: {}
    };
    describe('#patchForNetworkDeviceByName - errors', () => {
      it('should work if integrated or standalone with mockdata', (done) => {
        try {
          a.patchForNetworkDeviceByName(networkDeviceName, networkDevicePatchForNetworkDeviceByNameBodyParam, (data, error) => {
            try {
              if (stub) {
                runCommonAsserts(data, error);
                assert.equal('success', data.response);
              } else {
                runCommonAsserts(data, error);
              }
              saveMockData('NetworkDevice', 'patchForNetworkDeviceByName', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    describe('#getForNetworkDeviceByName - errors', () => {
      it('should work if integrated or standalone with mockdata', (done) => {
        try {
          a.getForNetworkDeviceByName(networkDeviceName, (data, error) => {
            try {
              if (stub) {
                runCommonAsserts(data, error);
                assert.equal(8, data.response.id);
                assert.equal('string', data.response.description);
                assert.equal('string', data.response.name);
                assert.equal('string', data.response.ip_address);
                assert.equal('string', data.response.radius_secret);
                assert.equal('string', data.response.tacacs_secret);
                assert.equal('string', data.response.vendor_name);
                assert.equal(false, data.response.coa_capable);
                assert.equal(1, data.response.coa_port);
                assert.equal(true, data.response.radsec_enabled);
                assert.equal('object', typeof data.response.snmp_read);
                assert.equal('object', typeof data.response.snmp_write);
                assert.equal('object', typeof data.response.cli_config);
                assert.equal('object', typeof data.response.onConnect_enforcement);
                assert.equal('object', typeof data.response.attributes);
              } else {
                runCommonAsserts(data, error);
              }
              saveMockData('NetworkDevice', 'getForNetworkDeviceByName', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    const networkDevicePutForNetworkDeviceBodyParam = {
      id: 5,
      description: 'string',
      name: 'string',
      ip_address: 'string',
      radius_secret: 'string',
      tacacs_secret: 'string',
      vendor_name: 'string',
      coa_capable: true,
      coa_port: 10,
      radsec_enabled: false,
      snmp_read: {
        force_read: false,
        read_arp_info: false,
        zone_name: 'string',
        snmp_version: 'V2C',
        community_string: 'string',
        security_level: 'AUTH_PRIV',
        user: 'string',
        auth_protocol: 'SHA',
        auth_key: 'string',
        privacy_protocol: 'AES_128',
        privacy_key: 'string'
      },
      snmp_write: {
        default_vlan: 9,
        snmp_version: 'V2C',
        community_string: 'string',
        security_level: 'AUTH_NOPRIV',
        user: 'string',
        auth_protocol: 'SHA',
        auth_key: 'string',
        privacy_protocol: 'DES_CBC',
        privacy_key: 'string'
      },
      cli_config: {
        type: 'Telnet',
        port: 7,
        username: 'string',
        password: 'string',
        username_prompt_regex: 'string',
        password_prompt_regex: 'string',
        command_prompt_regex: 'string',
        enable_prompt_regex: 'string',
        enable_password: 'string'
      },
      onConnect_enforcement: {
        enabled: true,
        ports: 'string'
      },
      attributes: {}
    };
    describe('#putForNetworkDevice - errors', () => {
      it('should work if integrated or standalone with mockdata', (done) => {
        try {
          a.putForNetworkDevice(networkDeviceNetworkDeviceId, networkDevicePutForNetworkDeviceBodyParam, (data, error) => {
            try {
              if (stub) {
                runCommonAsserts(data, error);
                assert.equal('success', data.response);
              } else {
                runCommonAsserts(data, error);
              }
              saveMockData('NetworkDevice', 'putForNetworkDevice', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    const networkDevicePatchForNetworkDeviceBodyParam = {
      id: 9,
      description: 'string',
      name: 'string',
      ip_address: 'string',
      radius_secret: 'string',
      tacacs_secret: 'string',
      vendor_name: 'string',
      coa_capable: true,
      coa_port: 5,
      radsec_enabled: false,
      snmp_read: {
        force_read: true,
        read_arp_info: true,
        zone_name: 'string',
        snmp_version: 'V1',
        community_string: 'string',
        security_level: 'AUTH_NOPRIV',
        user: 'string',
        auth_protocol: 'SHA',
        auth_key: 'string',
        privacy_protocol: 'DES_CBC',
        privacy_key: 'string'
      },
      snmp_write: {
        default_vlan: 10,
        snmp_version: 'V3',
        community_string: 'string',
        security_level: 'NOAUTH_NOPRIV',
        user: 'string',
        auth_protocol: 'MD5',
        auth_key: 'string',
        privacy_protocol: 'AES_128',
        privacy_key: 'string'
      },
      cli_config: {
        type: 'SSH',
        port: 8,
        username: 'string',
        password: 'string',
        username_prompt_regex: 'string',
        password_prompt_regex: 'string',
        command_prompt_regex: 'string',
        enable_prompt_regex: 'string',
        enable_password: 'string'
      },
      onConnect_enforcement: {
        enabled: false,
        ports: 'string'
      },
      attributes: {}
    };
    describe('#patchForNetworkDevice - errors', () => {
      it('should work if integrated or standalone with mockdata', (done) => {
        try {
          a.patchForNetworkDevice(networkDeviceNetworkDeviceId, networkDevicePatchForNetworkDeviceBodyParam, (data, error) => {
            try {
              if (stub) {
                runCommonAsserts(data, error);
                assert.equal('success', data.response);
              } else {
                runCommonAsserts(data, error);
              }
              saveMockData('NetworkDevice', 'patchForNetworkDevice', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    describe('#getGETForNetworkDevice - errors', () => {
      it('should work if integrated or standalone with mockdata', (done) => {
        try {
          a.getGETForNetworkDevice(networkDeviceNetworkDeviceId, (data, error) => {
            try {
              if (stub) {
                runCommonAsserts(data, error);
                assert.equal(1, data.response.id);
                assert.equal('string', data.response.description);
                assert.equal('string', data.response.name);
                assert.equal('string', data.response.ip_address);
                assert.equal('string', data.response.radius_secret);
                assert.equal('string', data.response.tacacs_secret);
                assert.equal('string', data.response.vendor_name);
                assert.equal(false, data.response.coa_capable);
                assert.equal(3, data.response.coa_port);
                assert.equal(true, data.response.radsec_enabled);
                assert.equal('object', typeof data.response.snmp_read);
                assert.equal('object', typeof data.response.snmp_write);
                assert.equal('object', typeof data.response.cli_config);
                assert.equal('object', typeof data.response.onConnect_enforcement);
                assert.equal('object', typeof data.response.attributes);
              } else {
                runCommonAsserts(data, error);
              }
              saveMockData('NetworkDevice', 'getGETForNetworkDevice', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    let networkDeviceGroupName = 'fakedata';
    let networkDeviceGroupNetworkDeviceGroupId = 555;
    const networkDeviceGroupPostForNetworkDeviceGroupBodyParam = {
      id: 9,
      name: 'string',
      description: 'string',
      group_format: 'string',
      value: 'string'
    };
    describe('#postForNetworkDeviceGroup - errors', () => {
      it('should work if integrated or standalone with mockdata', (done) => {
        try {
          a.postForNetworkDeviceGroup(networkDeviceGroupPostForNetworkDeviceGroupBodyParam, (data, error) => {
            try {
              if (stub) {
                runCommonAsserts(data, error);
                assert.equal(4, data.response.id);
                assert.equal('string', data.response.name);
                assert.equal('string', data.response.description);
                assert.equal('string', data.response.group_format);
                assert.equal('string', data.response.value);
              } else {
                runCommonAsserts(data, error);
              }
              networkDeviceGroupName = data.response.name;
              networkDeviceGroupNetworkDeviceGroupId = data.response.id;
              saveMockData('NetworkDeviceGroup', 'postForNetworkDeviceGroup', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    describe('#getForNetworkDeviceGroup - errors', () => {
      it('should work if integrated or standalone with mockdata', (done) => {
        try {
          a.getForNetworkDeviceGroup(null, null, null, null, null, (data, error) => {
            try {
              if (stub) {
                runCommonAsserts(data, error);
                assert.equal('object', typeof data.response._embedded);
                assert.equal('object', typeof data.response._links);
                assert.equal(3, data.response.count);
              } else {
                runCommonAsserts(data, error);
              }
              saveMockData('NetworkDeviceGroup', 'getForNetworkDeviceGroup', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    const networkDeviceGroupPutForNetworkDeviceGroupByNameBodyParam = {
      id: 9,
      name: 'string',
      description: 'string',
      group_format: 'string',
      value: 'string'
    };
    describe('#putForNetworkDeviceGroupByName - errors', () => {
      it('should work if integrated or standalone with mockdata', (done) => {
        try {
          a.putForNetworkDeviceGroupByName(networkDeviceGroupName, networkDeviceGroupPutForNetworkDeviceGroupByNameBodyParam, (data, error) => {
            try {
              if (stub) {
                runCommonAsserts(data, error);
                assert.equal('success', data.response);
              } else {
                runCommonAsserts(data, error);
              }
              saveMockData('NetworkDeviceGroup', 'putForNetworkDeviceGroupByName', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    const networkDeviceGroupPatchForNetworkDeviceGroupByNameBodyParam = {
      id: 9,
      name: 'string',
      description: 'string',
      group_format: 'string',
      value: 'string'
    };
    describe('#patchForNetworkDeviceGroupByName - errors', () => {
      it('should work if integrated or standalone with mockdata', (done) => {
        try {
          a.patchForNetworkDeviceGroupByName(networkDeviceGroupName, networkDeviceGroupPatchForNetworkDeviceGroupByNameBodyParam, (data, error) => {
            try {
              if (stub) {
                runCommonAsserts(data, error);
                assert.equal('success', data.response);
              } else {
                runCommonAsserts(data, error);
              }
              saveMockData('NetworkDeviceGroup', 'patchForNetworkDeviceGroupByName', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    describe('#getForNetworkDeviceGroupByName - errors', () => {
      it('should work if integrated or standalone with mockdata', (done) => {
        try {
          a.getForNetworkDeviceGroupByName(networkDeviceGroupName, (data, error) => {
            try {
              if (stub) {
                runCommonAsserts(data, error);
                assert.equal(2, data.response.id);
                assert.equal('string', data.response.name);
                assert.equal('string', data.response.description);
                assert.equal('string', data.response.group_format);
                assert.equal('string', data.response.value);
              } else {
                runCommonAsserts(data, error);
              }
              saveMockData('NetworkDeviceGroup', 'getForNetworkDeviceGroupByName', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    const networkDeviceGroupPutForNetworkDeviceGroupBodyParam = {
      id: 7,
      name: 'string',
      description: 'string',
      group_format: 'string',
      value: 'string'
    };
    describe('#putForNetworkDeviceGroup - errors', () => {
      it('should work if integrated or standalone with mockdata', (done) => {
        try {
          a.putForNetworkDeviceGroup(networkDeviceGroupNetworkDeviceGroupId, networkDeviceGroupPutForNetworkDeviceGroupBodyParam, (data, error) => {
            try {
              if (stub) {
                runCommonAsserts(data, error);
                assert.equal('success', data.response);
              } else {
                runCommonAsserts(data, error);
              }
              saveMockData('NetworkDeviceGroup', 'putForNetworkDeviceGroup', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    const networkDeviceGroupPatchForNetworkDeviceGroupBodyParam = {
      id: 3,
      name: 'string',
      description: 'string',
      group_format: 'string',
      value: 'string'
    };
    describe('#patchForNetworkDeviceGroup - errors', () => {
      it('should work if integrated or standalone with mockdata', (done) => {
        try {
          a.patchForNetworkDeviceGroup(networkDeviceGroupNetworkDeviceGroupId, networkDeviceGroupPatchForNetworkDeviceGroupBodyParam, (data, error) => {
            try {
              if (stub) {
                runCommonAsserts(data, error);
                assert.equal('success', data.response);
              } else {
                runCommonAsserts(data, error);
              }
              saveMockData('NetworkDeviceGroup', 'patchForNetworkDeviceGroup', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    describe('#getGETForNetworkDeviceGroup - errors', () => {
      it('should work if integrated or standalone with mockdata', (done) => {
        try {
          a.getGETForNetworkDeviceGroup(networkDeviceGroupNetworkDeviceGroupId, (data, error) => {
            try {
              if (stub) {
                runCommonAsserts(data, error);
                assert.equal(5, data.response.id);
                assert.equal('string', data.response.name);
                assert.equal('string', data.response.description);
                assert.equal('string', data.response.group_format);
                assert.equal('string', data.response.value);
              } else {
                runCommonAsserts(data, error);
              }
              saveMockData('NetworkDeviceGroup', 'getGETForNetworkDeviceGroup', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    describe('#deleteForStaticHostListByName - errors', () => {
      it('should work if integrated but since no mockdata should error when run standalone', (done) => {
        try {
          a.deleteForStaticHostListByName(staticHostListName, (data, error) => {
            try {
              if (stub) {
                const displayE = 'Error 400 received on request';
                runErrorAsserts(data, error, 'AD.500', 'Test-Adapter-Clear-Pass-connectorRest-handleEndResponse', displayE);
              } else {
                runCommonAsserts(data, error);
              }
              saveMockData('StaticHostList', 'deleteForStaticHostListByName', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    describe('#deleteForStaticHostList - errors', () => {
      it('should work if integrated but since no mockdata should error when run standalone', (done) => {
        try {
          a.deleteForStaticHostList(staticHostListStaticHostListId, (data, error) => {
            try {
              if (stub) {
                const displayE = 'Error 400 received on request';
                runErrorAsserts(data, error, 'AD.500', 'Test-Adapter-Clear-Pass-connectorRest-handleEndResponse', displayE);
              } else {
                runCommonAsserts(data, error);
              }
              saveMockData('StaticHostList', 'deleteForStaticHostList', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    describe('#deleteForRoleByName - errors', () => {
      it('should work if integrated but since no mockdata should error when run standalone', (done) => {
        try {
          a.deleteForRoleByName(roleName, (data, error) => {
            try {
              if (stub) {
                const displayE = 'Error 400 received on request';
                runErrorAsserts(data, error, 'AD.500', 'Test-Adapter-Clear-Pass-connectorRest-handleEndResponse', displayE);
              } else {
                runCommonAsserts(data, error);
              }
              saveMockData('Role', 'deleteForRoleByName', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    describe('#deleteForRole - errors', () => {
      it('should work if integrated but since no mockdata should error when run standalone', (done) => {
        try {
          a.deleteForRole(roleRoleId, (data, error) => {
            try {
              if (stub) {
                const displayE = 'Error 400 received on request';
                runErrorAsserts(data, error, 'AD.500', 'Test-Adapter-Clear-Pass-connectorRest-handleEndResponse', displayE);
              } else {
                runCommonAsserts(data, error);
              }
              saveMockData('Role', 'deleteForRole', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    describe('#deleteForLocalUserByUserId - errors', () => {
      it('should work if integrated but since no mockdata should error when run standalone', (done) => {
        try {
          a.deleteForLocalUserByUserId(localUserUserId, (data, error) => {
            try {
              if (stub) {
                const displayE = 'Error 400 received on request';
                runErrorAsserts(data, error, 'AD.500', 'Test-Adapter-Clear-Pass-connectorRest-handleEndResponse', displayE);
              } else {
                runCommonAsserts(data, error);
              }
              saveMockData('LocalUser', 'deleteForLocalUserByUserId', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    describe('#deleteForLocalUser - errors', () => {
      it('should work if integrated but since no mockdata should error when run standalone', (done) => {
        try {
          a.deleteForLocalUser(localUserLocalUserId, (data, error) => {
            try {
              if (stub) {
                const displayE = 'Error 400 received on request';
                runErrorAsserts(data, error, 'AD.500', 'Test-Adapter-Clear-Pass-connectorRest-handleEndResponse', displayE);
              } else {
                runCommonAsserts(data, error);
              }
              saveMockData('LocalUser', 'deleteForLocalUser', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    describe('#deleteForEndpointByMacAddress - errors', () => {
      it('should work if integrated but since no mockdata should error when run standalone', (done) => {
        try {
          a.deleteForEndpointByMacAddress(endpointMacAddress, (data, error) => {
            try {
              if (stub) {
                const displayE = 'Error 400 received on request';
                runErrorAsserts(data, error, 'AD.500', 'Test-Adapter-Clear-Pass-connectorRest-handleEndResponse', displayE);
              } else {
                runCommonAsserts(data, error);
              }
              saveMockData('Endpoint', 'deleteForEndpointByMacAddress', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    describe('#deleteForEndpoint - errors', () => {
      it('should work if integrated but since no mockdata should error when run standalone', (done) => {
        try {
          a.deleteForEndpoint(endpointEndpointId, (data, error) => {
            try {
              if (stub) {
                const displayE = 'Error 400 received on request';
                runErrorAsserts(data, error, 'AD.500', 'Test-Adapter-Clear-Pass-connectorRest-handleEndResponse', displayE);
              } else {
                runCommonAsserts(data, error);
              }
              saveMockData('Endpoint', 'deleteForEndpoint', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    describe('#deleteForProxyTargetByName - errors', () => {
      it('should work if integrated but since no mockdata should error when run standalone', (done) => {
        try {
          a.deleteForProxyTargetByName(proxyTargetName, (data, error) => {
            try {
              if (stub) {
                const displayE = 'Error 400 received on request';
                runErrorAsserts(data, error, 'AD.500', 'Test-Adapter-Clear-Pass-connectorRest-handleEndResponse', displayE);
              } else {
                runCommonAsserts(data, error);
              }
              saveMockData('ProxyTarget', 'deleteForProxyTargetByName', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    describe('#deleteForProxyTarget - errors', () => {
      it('should work if integrated but since no mockdata should error when run standalone', (done) => {
        try {
          a.deleteForProxyTarget(proxyTargetProxyTargetId, (data, error) => {
            try {
              if (stub) {
                const displayE = 'Error 400 received on request';
                runErrorAsserts(data, error, 'AD.500', 'Test-Adapter-Clear-Pass-connectorRest-handleEndResponse', displayE);
              } else {
                runCommonAsserts(data, error);
              }
              saveMockData('ProxyTarget', 'deleteForProxyTarget', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    describe('#deleteForNetworkDeviceByName - errors', () => {
      it('should work if integrated but since no mockdata should error when run standalone', (done) => {
        try {
          a.deleteForNetworkDeviceByName(networkDeviceName, (data, error) => {
            try {
              if (stub) {
                const displayE = 'Error 400 received on request';
                runErrorAsserts(data, error, 'AD.500', 'Test-Adapter-Clear-Pass-connectorRest-handleEndResponse', displayE);
              } else {
                runCommonAsserts(data, error);
              }
              saveMockData('NetworkDevice', 'deleteForNetworkDeviceByName', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    describe('#deleteForNetworkDevice - errors', () => {
      it('should work if integrated but since no mockdata should error when run standalone', (done) => {
        try {
          a.deleteForNetworkDevice(networkDeviceNetworkDeviceId, (data, error) => {
            try {
              if (stub) {
                const displayE = 'Error 400 received on request';
                runErrorAsserts(data, error, 'AD.500', 'Test-Adapter-Clear-Pass-connectorRest-handleEndResponse', displayE);
              } else {
                runCommonAsserts(data, error);
              }
              saveMockData('NetworkDevice', 'deleteForNetworkDevice', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    describe('#deleteForNetworkDeviceGroupByName - errors', () => {
      it('should work if integrated but since no mockdata should error when run standalone', (done) => {
        try {
          a.deleteForNetworkDeviceGroupByName(networkDeviceGroupName, (data, error) => {
            try {
              if (stub) {
                const displayE = 'Error 400 received on request';
                runErrorAsserts(data, error, 'AD.500', 'Test-Adapter-Clear-Pass-connectorRest-handleEndResponse', displayE);
              } else {
                runCommonAsserts(data, error);
              }
              saveMockData('NetworkDeviceGroup', 'deleteForNetworkDeviceGroupByName', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });

    describe('#deleteForNetworkDeviceGroup - errors', () => {
      it('should work if integrated but since no mockdata should error when run standalone', (done) => {
        try {
          a.deleteForNetworkDeviceGroup(networkDeviceGroupNetworkDeviceGroupId, (data, error) => {
            try {
              if (stub) {
                const displayE = 'Error 400 received on request';
                runErrorAsserts(data, error, 'AD.500', 'Test-Adapter-Clear-Pass-connectorRest-handleEndResponse', displayE);
              } else {
                runCommonAsserts(data, error);
              }
              saveMockData('NetworkDeviceGroup', 'deleteForNetworkDeviceGroup', 'default', data);
              done();
            } catch (err) {
              log.error(`Test Failure: ${err}`);
              done(err);
            }
          });
        } catch (error) {
          log.error(`Adapter Exception: ${error}`);
          done(error);
        }
      }).timeout(attemptTimeout);
    });
  });
});
