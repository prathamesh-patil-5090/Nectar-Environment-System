import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { NotificationsService, NotifyInput } from './notifications.service';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Notifications for one employee, newest first' })
  @ApiQuery({ name: 'employeeId', required: true })
  @ApiQuery({ name: 'unread', required: false })
  find(@Query('employeeId') employeeId: string, @Query('unread') unread?: string) {
    if (!employeeId) throw new BadRequestException('employeeId is required');
    return this.notificationsService.findForEmployee(employeeId, unread === '1' || unread === 'true');
  }

  @Post()
  @ApiOperation({ summary: 'Create a notification' })
  create(@Body() body: NotifyInput) {
    if (!body?.employeeId || !body.kind || !body.title) {
      throw new BadRequestException('employeeId, kind and title are required');
    }
    return this.notificationsService.notify(body);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications read for an employee' })
  markAllRead(@Body() body: { employeeId: string }) {
    if (!body?.employeeId) throw new BadRequestException('employeeId is required');
    return this.notificationsService.markAllRead(body.employeeId);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark one notification read' })
  markRead(@Param('id') id: string) {
    return this.notificationsService.markRead(id);
  }
}
