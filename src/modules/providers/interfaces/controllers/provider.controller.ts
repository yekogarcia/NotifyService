import {
  Controller,
  Post,
  Put,
  Body,
  Param,
  Req,
  UseGuards,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsObject,
  IsBoolean,
} from 'class-validator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationProviderEntity } from '../../domain/entities/provider.entity';
import { ProviderChannelEntity } from '../../domain/entities/provider-channel.entity';
import { ChannelType, ProviderType } from '../../../notifications/domain/enums';
import { AuthenticatedRequest } from '../../../../shared/infrastructure/guards/auth.guard';
import { AdminGuard } from '../../../auth/infrastructure/guards/admin.guard';
import { SecretsService } from '../../../../shared/infrastructure/security/secrets.service';
import { ProviderRegistry } from '../../application/provider-registry';

class CreateProviderDTO {
  @ApiProperty({ example: 'AWS SES' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ enum: ProviderType, example: ProviderType.SES })
  @IsEnum(ProviderType)
  providerType!: ProviderType;

  @ApiProperty({
    example: { host: 'email-smtp.us-east-1.amazonaws.com', port: 587 },
  })
  @IsObject()
  @IsNotEmpty()
  config!: Record<string, unknown>;

  @ApiPropertyOptional({
    example: 'arn:aws:ses:us-east-1:123456789:identity@example.com',
    description:
      'Non-sensitive reference (ARN, env var name). Omit if using secret.',
  })
  @IsOptional()
  @IsString()
  secretRef?: string;

  @ApiPropertyOptional({
    example: 'S3m1cw3b2026#',
    description:
      'Plaintext secret (password/token). Encrypted with AES-256-GCM before storage. Provide either secret or secretRef.',
  })
  @IsOptional()
  @IsString()
  secret?: string;
}

class UpdateProviderDTO {
  @ApiPropertyOptional({ example: 'AWS SES Updated' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ enum: ProviderType })
  @IsOptional()
  @IsEnum(ProviderType)
  providerType?: ProviderType;

  @ApiPropertyOptional({ example: { region: 'us-west-2' } })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  secretRef?: string;

  @ApiPropertyOptional({
    description: 'New plaintext secret; re-encrypted and replaces the old one.',
  })
  @IsOptional()
  @IsString()
  secret?: string;
}

class MapChannelDTO {
  @ApiProperty({ enum: ChannelType, example: ChannelType.EMAIL })
  @IsEnum(ChannelType)
  channel!: ChannelType;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@ApiTags('providers')
@UseGuards(AdminGuard)
@Controller('providers')
export class ProviderController {
  constructor(
    @InjectRepository(NotificationProviderEntity)
    private readonly repo: Repository<NotificationProviderEntity>,
    @InjectRepository(ProviderChannelEntity)
    private readonly channelRepo: Repository<ProviderChannelEntity>,
    private readonly secrets: SecretsService,
    private readonly registry: ProviderRegistry,
  ) {}

  @Post()
  @ApiOperation({
    summary:
      'Create a notification provider (tenant from JWT; secret encrypted at rest)',
  })
  @ApiBody({ type: CreateProviderDTO })
  @ApiResponse({ status: 201, description: 'Provider created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateProviderDTO,
  ) {
    const tenantId = req.user!.tenantId;
    const secretRef = this.buildSecretRef(dto.secret, dto.secretRef, true);

    const saved = await this.repo.save({
      tenantId,
      name: dto.name,
      providerType:
        dto.providerType as NotificationProviderEntity['providerType'],
      config: dto.config,
      secretRef,
      isActive: true,
    });
    return this.sanitize(saved);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update provider configuration' })
  @ApiParam({
    name: 'id',
    description: 'Provider UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiBody({ type: UpdateProviderDTO })
  @ApiResponse({ status: 200, description: 'Provider updated' })
  @ApiResponse({ status: 404, description: 'Provider not found' })
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateProviderDTO,
  ) {
    const tenantId = req.user!.tenantId;
    const existing = await this.repo.findOne({ where: { id, tenantId } });
    if (!existing) {
      throw new NotFoundException('Provider not found');
    }

    const update: Partial<NotificationProviderEntity> = {};
    if (dto.name !== undefined) update.name = dto.name;
    if (dto.providerType !== undefined) {
      update.providerType =
        dto.providerType as NotificationProviderEntity['providerType'];
    }
    if (dto.config !== undefined) update.config = dto.config;
    if (dto.secret !== undefined) {
      update.secretRef = this.secrets.encrypt(dto.secret);
    } else if (dto.secretRef !== undefined) {
      update.secretRef = dto.secretRef;
    }

    await this.repo.update({ id, tenantId }, update as Record<string, unknown>);
    await this.registry.invalidateForProvider(tenantId, id);
    const updated = await this.repo.findOne({ where: { id, tenantId } });
    return this.sanitize(updated!);
  }

  @Post(':id/channels')
  @ApiOperation({
    summary: 'Map provider to a delivery channel (1 active per channel)',
  })
  @ApiParam({
    name: 'id',
    description: 'Provider UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiBody({ type: MapChannelDTO })
  @ApiResponse({ status: 201, description: 'Provider mapped to channel' })
  @ApiResponse({ status: 404, description: 'Provider not found' })
  async mapChannel(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: MapChannelDTO,
  ) {
    const tenantId = req.user!.tenantId;
    const provider = await this.repo.findOne({ where: { id, tenantId } });
    if (!provider) {
      throw new NotFoundException('Provider not found');
    }

    const isActive = dto.isActive ?? true;

    if (isActive) {
      await this.channelRepo.update(
        { tenantId, channel: dto.channel, isActive: true },
        { isActive: false },
      );
    }

    const mapping = await this.channelRepo.save({
      tenantId,
      providerId: id,
      channel: dto.channel,
      isActive,
    });
    await this.registry.invalidate(tenantId, dto.channel);

    return {
      id: mapping.id,
      providerId: id,
      channel: dto.channel,
      isActive,
      mapped: true,
    };
  }

  private buildSecretRef(
    secret: string | undefined,
    secretRef: string | undefined,
    required: boolean,
  ): string {
    if (secret) {
      return this.secrets.encrypt(secret);
    }
    if (secretRef) {
      return secretRef;
    }
    if (required) {
      throw new BadRequestException(
        'Provide either secret (encrypted at rest) or secretRef',
      );
    }
    return '';
  }

  private sanitize(
    provider: NotificationProviderEntity,
  ): Record<string, unknown> {
    const encrypted = this.secrets.isEncrypted(provider.secretRef);
    return {
      id: provider.id,
      tenantId: provider.tenantId,
      name: provider.name,
      providerType: provider.providerType,
      config: provider.config,
      secretRef: encrypted ? '***encrypted***' : provider.secretRef,
      hasSecret: encrypted,
      isActive: provider.isActive,
      createdAt: provider.createdAt,
      updatedAt: provider.updatedAt,
    };
  }
}
