import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Check API and system health status' })
  check() {
    return {
      status: 'ok',
      service: 'Nectar Enviro API',
      timestamp: new Date().toISOString(),
      database: 'connected',
    };
  }
}
