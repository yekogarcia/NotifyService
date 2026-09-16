import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Query,
  Inject,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { CreateNotificationDTO } from '../../application/dto/create-notification.dto';
import { CreateNotificationUseCase } from '../../application/use-cases/create-notification/create-notification.use-case';
import { NotificationRepository } from '../../domain/repositories';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationController {
  constructor(
    private readonly createNotification: CreateNotificationUseCase,
    @Inject('NotificationRepository')
    private readonly notificationRepo: NotificationRepository,
  ) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Create a notification request' })
  @ApiBody({ type: CreateNotificationDTO })
  @ApiResponse({ status: 202, description: 'Notification accepted and queued' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(@Body() dto: CreateNotificationDTO) {
    const tenantId = 'db4acf04-d101-4d9b-8fe2-9513992b7c2a';
    const result = await this.createNotification.execute(tenantId, dto);
    return result;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get notification with deliveries and attempts' })
  @ApiResponse({ status: 200, description: 'Notification detail' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async findOne(@Param('id') id: string) {
    const notification =
      await this.notificationRepo.findWithDeliveriesAndAttempts(id);
    if (!notification) {
      return { statusCode: 404, message: 'Notification not found' };
    }
    return notification;
  }

  @Get()
  @ApiOperation({ summary: 'List notifications with pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return {
      message: 'List endpoint - implement with pagination',
      page: page ?? 1,
      limit: limit ?? 50,
    };
  }
}
