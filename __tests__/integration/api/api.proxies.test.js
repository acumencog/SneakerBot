const express = require('express');
const supertest = require('supertest');
const { getTracker, MockClient } = require('knex-mock-client');
const { router, urlProxies } = require('../../../routes');

jest.mock('../../../knexfile', () => ({
  test: { client: MockClient }
}));

const testProxy = {
  ip_address: '12.34.56.78',
  port: 80,
  protocol: 'http',
  username: 'testUsername',
  password: 'testPassword'
};

const testProxyCreated = {
  id: 1,
  ...testProxy,
  has_been_used: false,
  created_at: '2021-01-01T17:29:51.957Z',
  updated_at: '2021-01-01T17:29:51.957Z',
  is_deleted: false
};

let request;
let tracker;

const app = express();
app.use(express.json());
app.use('/', router);

beforeEach(() => {
  tracker.on.select('select 1+1').responseOnce([]);
});

afterEach(() => {
  tracker.reset();
});

beforeAll(() => {
  request = supertest(app);
  tracker = getTracker();
});

afterAll(() => {
  // This needs to be imported here to use the mock connection
  jest.unmock('../../../knexfile');
  jest.resetModules();
  // eslint-disable-next-line global-require
  const knex = require('../../../config/knex');
  knex.destroy();
});

describe('GET /proxies', () => {
  it('should find multiple proxies', async () => {
    const testProxies = [
      testProxyCreated,
      {
        ...testProxyCreated,
        id: 2
      },
      {
        ...testProxyCreated,
        id: 3
      }
    ];
    tracker.on.select('* from "proxies"').response(testProxies);

    const response = await request.get(urlProxies);

    expect(response.status).toBe(200);
    expect(response.body.success).toBeTruthy();
    expect(response.body.message).toBe('Proxies successfully found');
    expect(response.body.data).toEqual(testProxies);
  });

  it('should find a single proxy', async () => {
    const testProxies = [testProxyCreated];
    tracker.on.select('* from "proxies"').response(testProxies);

    const response = await request.get(urlProxies);

    expect(response.status).toBe(200);
    expect(response.body.success).toBeTruthy();
    expect(response.body.message).toBe('Proxies successfully found');
    expect(response.body.data).toEqual(testProxies);
  });

  it('should find no proxies', async () => {
    const testProxies = [];
    tracker.on.select('* from "proxies"').response(testProxies);

    const response = await request.get(urlProxies);

    expect(response.status).toBe(200);
    expect(response.body.success).toBeTruthy();
    expect(response.body.message).toBe('Proxies not found');
    expect(response.body.data).toEqual(testProxies);
  });
});

describe('GET /proxies/:id', () => {
  it('should findOne single proxy', async () => {
    tracker.on.select('* from "proxies"').response(testProxyCreated);

    const response = await request.get(`${urlProxies}/1`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBeTruthy();
    expect(response.body.message).toBe('Proxy successfully found');
    expect(response.body.data).toEqual(testProxyCreated);
  });

  it('should not findOne proxy', async () => {
    tracker.on.select('* from "proxies"').response(undefined);

    const response = await request.get(`${urlProxies}/2`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBeTruthy();
    expect(response.body.message).toBe('Proxy not found');
    expect(response.body.data).toBeUndefined();
  });
});

describe('POST /proxies', () => {
  it('should create an proxy', async () => {
    tracker.on.insert('into "proxies"').response([testProxyCreated]);

    const response = await request.post(urlProxies).send(testProxy);

    expect(response.status).toBe(200);
    expect(response.body.success).toBeTruthy();
    expect(response.body.message).toBe('Proxy successfully created');
    expect(response.body.data).toEqual(testProxyCreated);
  });

  it('should create no proxy when db insert fails', async () => {
    const testProxyWithError = {
      ...testProxy,
      ip_address: 'testWithTooManyCharacterstestWithTooManyCharacterstestWithTooManyCharacterstestWithTooManyCharacterstestWithTooManyCharacters'
        + 'testWithTooManyCharacterstestWithTooManyCharacterstestWithTooManyCharacterstestWithTooManyCharacterstestWithTooManyCharacters'
    };
    tracker.on.insert('into "proxies"').simulateError(new Error('DB insert failure'));

    const response = await request.post(urlProxies).send(testProxyWithError);

    expect(response.status).toBe(500);
    expect(response.body.success).toBeFalsy();
    expect(response.body.message).toContain('DB insert failure');
    expect(response.body.data).toEqual({});
  });

  it('should create no proxy when validation fails', async () => {
    const testProxyWithError = {
      ...testProxy,
      ip_address: null
    };
    tracker.on.insert('into "proxies"').simulateError(new Error('Validation failure'));

    const response = await request.post(urlProxies).send(testProxyWithError);

    expect(response.status).toBe(400);
    expect(response.body.success).toBeFalsy();
    expect(response.body.message).toBe('Validation Failed');
    expect(response.body.data.body[0].message).toEqual('"ip_address" must be a string');
  });
});

describe('PATCH /proxies:id', () => {
  it('should update known address', async () => {
    tracker.on.update('"proxies"').response([testProxyCreated]);

    const response = await request.patch(`${urlProxies}/1`).send(testProxy);

    expect(response.status).toBe(200);
    expect(response.body.success).toBeTruthy();
    expect(response.body.message).toBe('Proxy successfully updated');
    expect(response.body.data).toEqual(testProxyCreated);
  });

  it('should not update unknown proxy', async () => {
    tracker.on.update('"proxies"').response([]);

    const response = await request.patch(`${urlProxies}/1`).send(testProxy);

    expect(response.status).toBe(200);
    expect(response.body.success).toBeTruthy();
    expect(response.body.message).toBe('Proxy not updated');
    expect(response.body.data).toBeUndefined();
  });
});

describe('DELETE /proxies:id', () => {
  it('should delete known proxy', async () => {
    const testProxyDeleted = {
      ...testProxyCreated,
      is_deleted: true
    };
    tracker.on.update('"proxies"').response([testProxyDeleted]);

    const response = await request.delete(`${urlProxies}/1`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBeTruthy();
    expect(response.body.message).toBe('Proxy successfully deleted');
    expect(response.body.data).toEqual(testProxyDeleted);
  });

  it('should not delete unknown proxy', async () => {
    tracker.on.update('"proxies"').response([]);

    const response = await request.delete(`${urlProxies}/1`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBeTruthy();
    expect(response.body.message).toBe('Proxy not deleted');
    expect(response.body.data).toBeUndefined();
  });
});
