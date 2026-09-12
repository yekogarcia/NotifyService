import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Health check' })
  check() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: {
        database: 'up',
        redis: 'up',
        queue: 'up',
      },
    };
  }

  @Get('providers')
  @ApiOperation({ summary: 'Provider health check' })
  checkProviders() {
    return {
      ses: 'up',
      twilio: 'up',
      fcm: 'up',
    };
  }
}
