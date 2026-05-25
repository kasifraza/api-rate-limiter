import { RateLimitGuard, RateLimitConfig } from './index';

describe('RateLimitGuard - sliding window', () => {
  let guard: RateLimitGuard;
  let store: Map<string, [number, string][]>;
  let mockRedis: any;

  beforeEach(() => {
    store = new Map();
    mockRedis = {
      zremrangebyscore: jest.fn((key: string, _min: number, max: number) => {
        const entries = store.get(key) || [];
        store.set(key, entries.filter(([score]) => score > max));
        return Promise.resolve();
      }),
      zcard: jest.fn((key: string) => Promise.resolve((store.get(key) || []).length)),
      zadd: jest.fn((key: string, score: string, member: string) => {
        const entries = store.get(key) || [];
        entries.push([Number(score), member]);
        store.set(key, entries);
        return Promise.resolve();
      }),
      expire: jest.fn(() => Promise.resolve()),
    };

    const mockReflector = { get: jest.fn(() => ({ limit: 3, window: 60 } as RateLimitConfig)) };
    const mockOptions = { host: 'localhost', port: 6379, keyPrefix: 'test' };
    guard = new RateLimitGuard(mockReflector as any, mockRedis, mockOptions);
  });

  const createContext = (ip = '127.0.0.1') => ({
    getHandler: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ ip }) }),
  } as any);

  it('allows requests under the limit', async () => {
    expect(await guard.canActivate(createContext())).toBe(true);
    expect(await guard.canActivate(createContext())).toBe(true);
    expect(await guard.canActivate(createContext())).toBe(true);
  });

  it('blocks requests over the limit', async () => {
    await guard.canActivate(createContext());
    await guard.canActivate(createContext());
    await guard.canActivate(createContext());
    expect(await guard.canActivate(createContext())).toBe(false);
  });

  it('uses different keys for different IPs', async () => {
    await guard.canActivate(createContext('1.1.1.1'));
    await guard.canActivate(createContext('1.1.1.1'));
    await guard.canActivate(createContext('1.1.1.1'));
    expect(await guard.canActivate(createContext('1.1.1.1'))).toBe(false);
    expect(await guard.canActivate(createContext('2.2.2.2'))).toBe(true);
  });
});
