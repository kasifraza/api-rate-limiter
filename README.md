# @kasifraza/api-rate-limiter

[![npm version](https://img.shields.io/npm/v/@kasifraza/api-rate-limiter.svg)](https://www.npmjs.com/package/@kasifraza/api-rate-limiter)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Redis-backed rate limiter for NestJS with sliding window and per-user/IP limits.

## Installation

```bash
npm install @kasifraza/api-rate-limiter ioredis
```

## Usage

### Module Registration

```typescript
import { RateLimitModule } from '@kasifraza/api-rate-limiter';

@Module({
  imports: [
    RateLimitModule.register({
      host: 'localhost',
      port: 6379,
      password: 'optional',
      keyPrefix: 'rl',
    }),
  ],
})
export class AppModule {}
```

### Apply Rate Limiting

```typescript
import { RateLimit, RateLimitGuard } from '@kasifraza/api-rate-limiter';
import { UseGuards, Controller, Get } from '@nestjs/common';

@Controller('api')
export class ApiController {
  @Get('data')
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 100, window: 60 }) // 100 requests per 60 seconds
  getData() {
    return { data: 'ok' };
  }
}
```

### Custom Key

```typescript
@RateLimit({ limit: 10, window: 60, key: 'user.id' })
```

## Algorithm

Uses a sliding window algorithm with Redis sorted sets (ZADD, ZREMRANGEBYSCORE, ZCARD) for accurate per-window counting.

## License

MIT
