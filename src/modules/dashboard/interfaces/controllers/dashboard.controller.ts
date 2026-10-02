import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import {
  IsOptional,
  IsISO8601,
  IsUUID,
  IsEnum,
  IsIn,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AuthenticatedRequest } from '../../../../shared/infrastructure/guards/auth.guard';
import { AdminGuard } from '../../../auth/infrastructure/guards/admin.guard';
import {
  DashboardService,
  DashboardFilters,
} from '../../application/dashboard.service';
import { ChannelType } from '../../../notifications/domain/enums';

class DashboardQuery {
  @ApiPropertyOptional({ description: 'ISO date, default: 30 days ago' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ description: 'ISO date, default: now' })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({ description: 'Filter by application UUID' })
  @IsOptional()
  @IsUUID()
  applicationId?: string;

  @ApiPropertyOptional({ enum: ChannelType })
  @IsOptional()
  @IsEnum(ChannelType)
  channel?: ChannelType;
}

class VolumeQuery extends DashboardQuery {
  @ApiPropertyOptional({ enum: ['day', 'hour'], example: 'day' })
  @IsOptional()
  @IsIn(['day', 'hour'])
  granularity?: 'day' | 'hour';
}

class LimitQuery extends DashboardQuery {
  @ApiPropertyOptional({ example: 10, type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

const RANGE_NOTE =
  'Common filters: from/to (ISO dates, default last 30 days), applicationId, channel.';

@ApiTags('dashboard')
@UseGuards(AdminGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  private filters(tenantId: string, q: DashboardQuery): DashboardFilters {
    return {
      tenantId,
      from: q.from,
      to: q.to,
      applicationId: q.applicationId,
      channel: q.channel,
    };
  }

  @Get('summary')
  @ApiOperation({
    summary: 'KPI summary for the period',
    description: RANGE_NOTE,
  })
  @ApiResponse({
    status: 200,
    example: {
      notifications: 120,
      deliveries: 200,
      sent: 185,
      failed: 8,
      pending: 7,
      retried: 12,
      avgAttempts: 1.1,
      successRate: 0.925,
      activeApps: 3,
      activeProviders: 4,
    },
  })
  summary(@Req() req: AuthenticatedRequest, @Query() q: DashboardQuery) {
    return this.dashboard.summary(this.filters(req.user!.tenantId, q));
  }

  @Get('volume')
  @ApiOperation({
    summary: 'Notifications/deliveries time series',
    description: RANGE_NOTE,
  })
  @ApiResponse({
    status: 200,
    example: [
      {
        bucket: '2026-09-29T00:00:00.000Z',
        notifications: 40,
        deliveries: 65,
        sent: 60,
        failed: 3,
      },
    ],
  })
  volume(@Req() req: AuthenticatedRequest, @Query() q: VolumeQuery) {
    return this.dashboard.volume(
      this.filters(req.user!.tenantId, q),
      q.granularity ?? 'day',
    );
  }

  @Get('by-channel')
  @ApiOperation({
    summary: 'Deliveries + success rate per channel (failure % by channel)',
    description: RANGE_NOTE,
  })
  @ApiResponse({
    status: 200,
    example: [
      {
        channel: 'EMAIL',
        deliveries: 120,
        sent: 115,
        failed: 3,
        pending: 2,
        successRate: 0.958,
      },
    ],
  })
  byChannel(@Req() req: AuthenticatedRequest, @Query() q: DashboardQuery) {
    return this.dashboard.byChannel(this.filters(req.user!.tenantId, q));
  }

  @Get('by-application')
  @ApiOperation({
    summary: 'Notifications/deliveries per application (top N)',
    description: RANGE_NOTE,
  })
  @ApiResponse({
    status: 200,
    example: [
      {
        applicationId: '550e8400-e29b-41d4-a716-446655440000',
        appName: 'mi-app',
        notifications: 80,
        deliveries: 130,
        sent: 120,
        failed: 5,
        successRate: 0.923,
      },
    ],
  })
  byApplication(@Req() req: AuthenticatedRequest, @Query() q: LimitQuery) {
    return this.dashboard.byApplication(
      this.filters(req.user!.tenantId, q),
      q.limit ?? 10,
    );
  }

  @Get('by-provider')
  @ApiOperation({
    summary: 'Deliveries + success rate per provider (NULL = .env fallback)',
    description: RANGE_NOTE,
  })
  @ApiResponse({
    status: 200,
    example: [
      {
        providerId: '550e8400-e29b-41d4-a716-446655440000',
        providerName: 'AWS SES SMTP',
        providerType: 'SES',
        providerStatus: 'ACTIVE',
        deliveries: 100,
        sent: 96,
        failed: 2,
        successRate: 0.96,
        avgAttempts: 1.05,
        lastErrorType: 'SmtpError',
        lastActivityAt: '2026-09-30T10:00:00.000Z',
      },
    ],
  })
  byProvider(@Req() req: AuthenticatedRequest, @Query() q: DashboardQuery) {
    return this.dashboard.byProvider(this.filters(req.user!.tenantId, q));
  }

  @Get('failures')
  @ApiOperation({
    summary: 'Top error types, result split, recent failed deliveries',
    description: RANGE_NOTE,
  })
  @ApiResponse({
    status: 200,
    example: {
      byErrorType: [{ errorType: 'SmtpError', count: 5 }],
      resultSplit: [
        { result: 'SUCCESS', count: 180 },
        { result: 'TRANSIENT_ERROR', count: 6 },
        { result: 'PERMANENT_ERROR', count: 2 },
      ],
      recent: [
        {
          deliveryId: '770e8400-e29b-41d4-a716-446655440000',
          notificationId: '880e8400-e29b-41d4-a716-446655440000',
          channel: 'EMAIL',
          status: 'FAILED',
          attemptCount: 3,
          providerId: '550e8400-e29b-41d4-a716-446655440000',
          providerName: 'AWS SES SMTP',
          lastError: 'Connection timeout',
          updatedAt: '2026-09-30T10:00:00.000Z',
        },
      ],
    },
  })
  failures(@Req() req: AuthenticatedRequest, @Query() q: LimitQuery) {
    return this.dashboard.failures(
      this.filters(req.user!.tenantId, q),
      q.limit ?? 10,
    );
  }

  @Get('latency')
  @ApiOperation({
    summary: 'Send latency (created→sent) avg/p50/p95 in seconds per channel',
    description: RANGE_NOTE,
  })
  @ApiResponse({
    status: 200,
    example: [
      {
        channel: 'EMAIL',
        deliveries: 115,
        avgSeconds: 4.2,
        p50Seconds: 2.1,
        p95Seconds: 12.8,
      },
    ],
  })
  latency(@Req() req: AuthenticatedRequest, @Query() q: DashboardQuery) {
    return this.dashboard.latency(this.filters(req.user!.tenantId, q));
  }

  @Get('activity')
  @ApiOperation({ summary: 'Recent event feed for the tenant' })
  @ApiResponse({
    status: 200,
    example: [
      {
        id: '990e8400-e29b-41d4-a716-446655440000',
        eventType: 'DELIVERY_SENT',
        notificationId: '880e8400-e29b-41d4-a716-446655440000',
        deliveryId: '770e8400-e29b-41d4-a716-446655440000',
        applicationId: '550e8400-e29b-41d4-a716-446655440000',
        appName: 'mi-app',
        createdAt: '2026-09-30T10:00:00.000Z',
      },
    ],
  })
  activity(@Req() req: AuthenticatedRequest, @Query() q: LimitQuery) {
    return this.dashboard.activity(
      this.filters(req.user!.tenantId, q),
      q.limit ?? 20,
    );
  }
}
