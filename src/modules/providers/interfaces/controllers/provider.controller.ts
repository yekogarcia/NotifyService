import {
  Controller,
  Post,
  Put,
  Body,
  Param,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationProviderEntity } from '../../domain/entities/provider.entity';
import { ProviderType } from '../../../notifications/domain/enums';

class CreateProviderDTO {
  @ApiProperty({ example: 'AWS SES' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ enum: ProviderType, example: ProviderType.SES })
  @IsEnum(ProviderType)
  providerType!: ProviderType;

  @ApiProperty({ example: { region: 'us-east-1' } })
  @IsNotEmpty()
  config!: Record<string, unknown>;

  @ApiProperty({ example: 'arn:aws:ses:us-east-1:123456789:identity@example.com' })
  @IsString()
  @IsNotEmpty()
  secretRef!: string;
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
  config?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  secretRef?: string;
}

class MapChannelDTO {
  @ApiProperty({ enum: ['EMAIL', 'SMS', 'PUSH', 'WHATSAPP', 'WEBHOOK', 'SLACK', 'TEAMS'], example: 'EMAIL' })
  @IsString()
  @IsNotEmpty()
  channel!: string;
}

@ApiTags('providers')
@Controller('providers')
export class ProviderController {
  constructor(
    @InjectRepository(NotificationProviderEntity)
    private readonly repo: Repository<NotificationProviderEntity>,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a notification provider' })
  @ApiBody({ type: CreateProviderDTO })
  @ApiResponse({ status: 201, description: 'Provider created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async create(@Body() dto: CreateProviderDTO) {
    return this.repo.save({
      tenantId: 'default-tenant',
      name: dto.name,
      providerType: dto.providerType as NotificationProviderEntity['providerType'],
      config: dto.config,
      secretRef: dto.secretRef,
      isActive: true,
    });
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update provider configuration' })
  @ApiParam({ name: 'id', description: 'Provider UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiBody({ type: UpdateProviderDTO })
  @ApiResponse({ status: 200, description: 'Provider updated' })
  @ApiResponse({ status: 404, description: 'Provider not found' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProviderDTO,
  ) {
    await this.repo.update(id, dto as any);
    return this.repo.findOne({ where: { id } });
  }

  @Post(':id/channels')
  @ApiOperation({ summary: 'Map provider to a delivery channel' })
  @ApiParam({ name: 'id', description: 'Provider UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiBody({ type: MapChannelDTO })
  @ApiResponse({ status: 200, description: 'Provider mapped to channel' })
  async mapChannel(
    @Param('id') id: string,
    @Body() dto: MapChannelDTO,
  ) {
    return {
      providerId: id,
      channel: dto.channel,
      mapped: true,
    };
  }
}
