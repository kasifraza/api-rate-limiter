import { Module, DynamicModule, Injectable, CanActivate, ExecutionContext, SetMetadata, Inject } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import Redis from 'ioredis';

export interface RateLimitOptions {
  host: string;
  port: number;
  password?: string;
  keyPrefix?: string;
}

export interface RateLimitConfig {
  limit: number;
  window: number; // seconds
  key?: string;
}

const RATE_LIMIT_KEY = 'RATE_LIMIT';

export const RateLimit = (config: RateLimitConfig) => SetMetadata(RATE_LIMIT_KEY, config);

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @Inject('RATE_LIMIT_REDIS') private redis: Redis,
    @Inject('RATE_LIMIT_OPTIONS') private options: RateLimitOptions,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const config = this.reflector.get<RateLimitConfig>(RATE_LIMIT_KEY, context.getHandler());
    if (!config) return true;

    const request = context.switchToHttp().getRequest();
    const identifier = config.key
      ? request[config.key]
      : request.ip || request.headers['x-forwarded-for'] || 'unknown';

    const key = `${this.options.keyPrefix || 'rl'}:${identifier}`;
    const now = Date.now();
    const windowStart = now - config.window * 1000;

    await this.redis.zremrangebyscore(key, 0, windowStart);
    const count = await this.redis.zcard(key);

    if (count >= config.limit) return false;

    await this.redis.zadd(key, now.toString(), `${now}-${Math.random()}`);
    await this.redis.expire(key, config.window);
    return true;
  }
}

@Module({})
export class RateLimitModule {
  static register(options: RateLimitOptions): DynamicModule {
    const redisProvider = {
      provide: 'RATE_LIMIT_REDIS',
      useFactory: () => new Redis({ host: options.host, port: options.port, password: options.password }),
    };
    const optionsProvider = { provide: 'RATE_LIMIT_OPTIONS', useValue: options };

    return {
      module: RateLimitModule,
      providers: [redisProvider, optionsProvider, RateLimitGuard, Reflector],
      exports: [RateLimitGuard, 'RATE_LIMIT_REDIS'],
      global: true,
    };
  }
}
