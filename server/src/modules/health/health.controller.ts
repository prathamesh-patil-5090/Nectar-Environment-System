import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  @Get()
  @ApiOperation({ summary: 'Check API and system health status' })
  check() {
    const readyState = this.connection.readyState;
    // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
    const database =
      readyState === 1
        ? 'connected'
        : readyState === 2
          ? 'connecting'
          : 'disconnected';

    return {
      status: database === 'connected' ? 'ok' : 'degraded',
      service: 'Nectar Enviro API',
      timestamp: new Date().toISOString(),
      database,
      dbName: this.connection.name || null,
    };
  }
}
