const assert = require('assert');
const app = require('../../src/app');

describe('\'Seeker\' service', () => {
  it('registered the service', () => {
    const service = app.service('seeker');

    assert.ok(service, 'Registered the service');
  });
});
