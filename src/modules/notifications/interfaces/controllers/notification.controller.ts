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
  Req,
  BadRequestException,
  NotFoundException,
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
import { NotificationEntity } from '../../domain/entities/notification.entity';
import { ApplicationEntity } from '../../../applications/domain/entities/application.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthenticatedRequest } from '../../../../shared/infrastructure/guards/auth.guard';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationController {
  constructor(
    private readonly createNotification: CreateNotificationUseCase,
    @Inject('NotificationRepository')
    private readonly notificationRepo: NotificationRepository,
    @InjectRepository(ApplicationEntity)
    private readonly appRepo: Repository<ApplicationEntity>,
    @InjectRepository(NotificationEntity)
    private readonly notifications: Repository<NotificationEntity>,
  ) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Create a notification request',
    description:
      'Funciona con ambos logins: client_credentials (la aplicación se toma ' +
      'del JWT) y password/admin (la aplicación se envía en `applicationId` ' +
      'del body y debe pertenecer al tenant del token).',
  })
  @ApiBody({ type: CreateNotificationDTO })
  @ApiResponse({ status: 202, description: 'Notification accepted and queued' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateNotificationDTO,
  ) {
    const tenantId = req.user!.tenantId;
    const tokenAppId =
      req.user!.type === 'api' ? (req.user!.sub as string) : undefined;
    if (tokenAppId && dto.applicationId && dto.applicationId !== tokenAppId) {
      throw new BadRequestException(
        'applicationId in body does not match token application',
      );
    }
    const applicationId = tokenAppId ?? dto.applicationId;
    if (!applicationId) {
      throw new BadRequestException(
        'applicationId is required (send it in body or use a client_credentials token)',
      );
    }
    // La aplicación debe existir y pertenecer al tenant del token.
    const app = await this.appRepo.findOne({
      where: { id: applicationId, tenantId },
    });
    if (!app) {
      throw new NotFoundException('Application not found for this tenant');
    }
    const result = await this.createNotification.execute(
      tenantId,
      applicationId,
      dto,
    );
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
  @ApiOperation({
    summary: 'List notifications with pagination and filters',
    description:
      'Solo del tenant del JWT, más recientes primero. `date=YYYY-MM-DD` ' +
      'filtra por día UTC de creación.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'applicationId', required: false, type: String })
  @ApiQuery({
    name: 'date',
    required: false,
    type: String,
    description: 'Día UTC YYYY-MM-DD (created_at >= día 00:00 y < día+1 00:00)',
  })
  @ApiResponse({ status: 200, description: '{ items, page, limit, total }' })
  async findAll(
    @Req() req: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('applicationId') applicationId?: string,
    @Query('date') date?: string,
  ) {
    const tenantId = req.user!.tenantId;
    const take = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const current = Math.max(Number(page) || 1, 1);

    const qb = this.notifications
      .createQueryBuilder('n')
      .leftJoinAndSelect('n.deliveries', 'd')
      .where('n.tenantId = :tenantId', { tenantId })
      .orderBy('n.createdAt', 'DESC')
      .take(take)
      .skip((current - 1) * take);

    if (status) qb.andWhere('n.status = :status', { status });
    if (applicationId)
      qb.andWhere('n.applicationId = :applicationId', { applicationId });
    if (date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new BadRequestException('date debe ser YYYY-MM-DD');
      }
      const [y, m, day] = date.split('-').map(Number);
      const next = new Date(Date.UTC(y, m - 1, day) + 86_400_000)
        .toISOString()
        .slice(0, 10);
      qb.andWhere('n.createdAt >= :from AND n.createdAt < :to', {
        from: `${date}T00:00:00.000Z`,
        to: `${next}T00:00:00.000Z`,
      });
    }

    const [items, total] = await qb.getManyAndCount();
    return { items, page: current, limit: take, total };
  }
}
