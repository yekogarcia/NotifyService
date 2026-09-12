import {
  Controller,
  Post,
  Put,
  Body,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationProviderEntity } from '../../domain/entities/provider.entity';

class CreateProviderDTO {
  name!: string;
  providerType!: string;
  config!: Record<string, unknown>;
  secretRef!: string;
}

class MapChannelDTO {
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
  @ApiOperation({ summary: 'Create a provider' })
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
  @ApiOperation({ summary: 'Update provider config' })
  async update(
    @Param('id') id: string,
    @Body() dto: Partial<CreateProviderDTO>,
  ) {
    await this.repo.update(id, dto);
    return this.repo.findOne({ where: { id } });
  }

  @Post(':id/channels')
  @ApiOperation({ summary: 'Map provider to a channel' })
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
