import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
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
import { Repository, Not, In } from 'typeorm';
import { NotificationProviderEntity } from '../../domain/entities/provider.entity';
import { ProviderChannelEntity } from '../../domain/entities/provider-channel.entity';
import { NotificationDeliveryEntity } from '../../../notifications/domain/entities/notification-delivery.entity';
import {
  ChannelType,
  ProviderType,
  ProviderStatus,
} from '../../../notifications/domain/enums';
import { AuthenticatedRequest } from '../../../../shared/infrastructure/guards/auth.guard';
import { AdminGuard } from '../../../auth/infrastructure/guards/admin.guard';
import { SecretsService } from '../../../../shared/infrastructure/security/secrets.service';
import { ProviderRegistry } from '../../application/provider-registry';

/**
 * Tipos genéricos (3) y su `config` esperada. El secreto (password/token)
 * NUNCA va dentro de `config`: viaja en el campo `secret` y se cifra
 * AES-256-GCM antes de guardarse. El vendedor concreto (SES, Twilio, Meta…)
 * puede cambiar sin cambiar el tipo: solo cambia el contenido de `config`.
 */
const PROVIDER_CONFIG_EXAMPLES = {
  email: {
    summary: 'EMAIL (providerType: EMAIL)',
    description:
      'Email via SMTP (sirve SES por SMTP o cualquier servidor SMTP). El password va en `secret`.',
    value: {
      transport: 'smtp',
      host: 'smtp.tu-dominio.com',
      port: 587,
      secure: false,
      starttls: true,
      username: 'usuario-smtp',
      fromAddress: 'contacto@tu-dominio.com',
    },
  },
  sms: {
    summary: 'SMS (providerType: SMS)',
    description:
      'SMS genérico (número remitente + credenciales del proveedor actual). El token va en `secret`.',
    value: {
      accountSid: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      fromNumber: '+15551234567',
    },
  },
  whatsapp: {
    summary: 'WHATSAPP (providerType: WHATSAPP)',
    description:
      'WhatsApp Cloud API (Meta). El token permanente de Meta va en `secret`.',
    value: {
      phoneNumberId: '123456789012345',
      apiVersion: 'v21.0',
    },
  },
} as const;

const PROVIDER_TYPE_DOC =
  'Tipo de proveedor (genérico, 3): ' +
  'EMAIL = correo, SMS = mensajes de texto, WHATSAPP = WhatsApp. ' +
  'Cada tipo exige su forma de `config` (ver ejemplos del campo `config`).';

class CreateProviderDTO {
  @ApiProperty({ example: 'AWS SES SMTP' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
    enum: ProviderType,
    example: ProviderType.EMAIL,
    description: PROVIDER_TYPE_DOC,
  })
  @IsEnum(ProviderType)
  providerType!: ProviderType;

  @ApiProperty({
    description:
      'Objeto `config` según el tipo (el secreto va en `secret`, no aquí). ' +
      'EMAIL: { transport, host, port, secure, starttls, username, fromAddress }. ' +
      'SMS: { accountSid?, fromNumber, ...campos del proveedor actual }. ' +
      'WHATSAPP: { phoneNumberId, apiVersion? }. ' +
      'Despliega los ejemplos por tipo.',
    example: PROVIDER_CONFIG_EXAMPLES.email.value,
    examples: PROVIDER_CONFIG_EXAMPLES,
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
      'Plaintext secret (se cifra AES-256-GCM antes de guardarse; nunca se devuelve en plano). ' +
      'Según el tipo: EMAIL = password SMTP, SMS = token del proveedor SMS, ' +
      'WHATSAPP = access token permanente de Meta. ' +
      'Provide either secret or secretRef.',
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

  @ApiPropertyOptional({
    enum: ProviderType,
    description: PROVIDER_TYPE_DOC,
  })
  @IsOptional()
  @IsEnum(ProviderType)
  providerType?: ProviderType;

  @ApiPropertyOptional({
    description:
      'Objeto `config` según el tipo (ver ejemplos del POST). ' +
      'EMAIL: { transport, host, port, secure, starttls, username, fromAddress }. ' +
      'SMS: { accountSid?, fromNumber, ...campos del proveedor actual }. ' +
      'WHATSAPP: { phoneNumberId, apiVersion? }.',
    example: PROVIDER_CONFIG_EXAMPLES.email.value,
    examples: PROVIDER_CONFIG_EXAMPLES,
  })
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

  @ApiPropertyOptional({
    enum: ProviderStatus,
    example: ProviderStatus.ACTIVE,
    description: 'ACTIVE | INACTIVE. DELETED solo via DELETE.',
  })
  @IsOptional()
  @IsEnum(ProviderStatus)
  status?: ProviderStatus;

  @ApiPropertyOptional({
    example: true,
    description: 'Activa/inactiva el proveedor (sincronizado con status).',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

class MapChannelDTO {
  @ApiProperty({
    enum: ChannelType,
    example: ChannelType.EMAIL,
    description:
      'Canal al que se mapea. Normalmente coincide con el tipo: EMAIL → EMAIL, SMS → SMS, WHATSAPP → WHATSAPP.',
  })
  @IsEnum(ChannelType)
  channel!: ChannelType;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/** Respuesta sanitizada (el secreto nunca sale en plano). */
const PROVIDER_RESPONSE_EXAMPLE = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  tenantId: '660e8400-e29b-41d4-a716-446655440000',
  name: 'SMTP corporativo',
  providerType: 'EMAIL',
  transport: 'smtp',
  host: 'smtp.tu-dominio.com',
  port: 587,
  username: 'usuario-smtp',
  fromAddress: 'contacto@tu-dominio.com',
  config: {
    transport: 'smtp',
    host: 'smtp.tu-dominio.com',
    port: 587,
    secure: false,
    starttls: true,
    username: 'usuario-smtp',
    fromAddress: 'contacto@tu-dominio.com',
  },
  secretRef: '***encrypted***',
  hasSecret: true,
  isActive: true,
  status: 'ACTIVE',
  channels: ['EMAIL'],
  createdAt: '2026-09-30T10:00:00.000Z',
  updatedAt: '2026-09-30T10:00:00.000Z',
};

@ApiTags('providers')
@UseGuards(AdminGuard)
@Controller('providers')
export class ProviderController {
  constructor(
    @InjectRepository(NotificationProviderEntity)
    private readonly repo: Repository<NotificationProviderEntity>,
    @InjectRepository(ProviderChannelEntity)
    private readonly channelRepo: Repository<ProviderChannelEntity>,
    @InjectRepository(NotificationDeliveryEntity)
    private readonly deliveryRepo: Repository<NotificationDeliveryEntity>,
    private readonly secrets: SecretsService,
    private readonly registry: ProviderRegistry,
  ) {}

  @Post()
  @ApiOperation({
    summary:
      'Create a notification provider (tenant from JWT; secret encrypted at rest)',
    description:
      'Tipos genéricos (3): EMAIL, SMS, WHATSAPP. Despliega "Examples" del body para ver el ' +
      '`config` + `secret` de cada tipo. Luego mapea el proveedor a su canal ' +
      'con POST /providers/:id/channels.',
  })
  @ApiBody({
    type: CreateProviderDTO,
    examples: {
      email: {
        summary: 'EMAIL',
        value: {
          name: 'SMTP corporativo',
          providerType: 'EMAIL',
          config: PROVIDER_CONFIG_EXAMPLES.email.value,
          secret: 'tu-password-smtp',
        },
      },
      sms: {
        summary: 'SMS',
        value: {
          name: 'SMS proveedor',
          providerType: 'SMS',
          config: PROVIDER_CONFIG_EXAMPLES.sms.value,
          secret: 'tu-token-del-proveedor-sms',
        },
      },
      whatsapp: {
        summary: 'WHATSAPP (Meta)',
        value: {
          name: 'WhatsApp Meta',
          providerType: 'WHATSAPP',
          config: PROVIDER_CONFIG_EXAMPLES.whatsapp.value,
          secret: 'tu-access-token-permanente-de-meta',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Provider created successfully (secret masked)',
    example: PROVIDER_RESPONSE_EXAMPLE,
  })
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
      status: ProviderStatus.ACTIVE,
    });
    return this.sanitize(saved);
  }

  @Get()
  @ApiOperation({
    summary:
      'List all providers for tenant (from JWT; secrets masked, no plaintext). Excludes DELETED.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of providers (DELETED excluded)',
    example: [PROVIDER_RESPONSE_EXAMPLE],
  })
  async findAll(@Req() req: AuthenticatedRequest) {
    const tenantId = req.user!.tenantId;
    const providers = await this.repo.find({
      where: { tenantId, status: Not(ProviderStatus.DELETED) },
      order: { createdAt: 'DESC' },
    });
    const channelsByProvider = await this.activeChannelsByProvider(tenantId);
    return providers.map((p) => ({
      ...this.sanitize(p),
      channels: channelsByProvider.get(p.id) ?? [],
    }));
  }

  @Get('mappings')
  @ApiOperation({
    summary:
      'List all provider↔channel mappings for tenant (1 active per channel)',
  })
  @ApiResponse({
    status: 200,
    description: 'Mappings with provider info',
    example: [
      {
        id: '770e8400-e29b-41d4-a716-446655440000',
        tenantId: '660e8400-e29b-41d4-a716-446655440000',
        channel: 'EMAIL',
        isActive: true,
        providerId: '550e8400-e29b-41d4-a716-446655440000',
        providerName: 'AWS SES SMTP',
        providerType: 'SES',
        providerStatus: 'ACTIVE',
        createdAt: '2026-09-30T10:00:00.000Z',
      },
    ],
  })
  async listMappings(@Req() req: AuthenticatedRequest) {
    const tenantId = req.user!.tenantId;
    const mappings = await this.channelRepo.find({
      where: { tenantId },
      order: { channel: 'ASC' },
    });
    const providerIds = [...new Set(mappings.map((m) => m.providerId))];
    const providers =
      providerIds.length > 0
        ? await this.repo.find({
            where: { tenantId, id: In(providerIds) },
          })
        : [];
    const byId = new Map(providers.map((p) => [p.id, p]));
    return mappings.map((m) => {
      const p = byId.get(m.providerId);
      return {
        id: m.id,
        tenantId,
        channel: m.channel,
        isActive: m.isActive,
        providerId: m.providerId,
        providerName: p?.name ?? null,
        providerType: p?.providerType ?? null,
        providerStatus: p?.status ?? null,
        createdAt: m.createdAt,
      };
    });
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get provider by ID (tenant from JWT; excludes DELETED)',
  })
  @ApiParam({
    name: 'id',
    description: 'Provider UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Provider found',
    example: PROVIDER_RESPONSE_EXAMPLE,
  })
  @ApiResponse({ status: 404, description: 'Provider not found' })
  async findOne(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const tenantId = req.user!.tenantId;
    const provider = await this.repo.findOne({ where: { id, tenantId } });
    if (!provider || provider.status === ProviderStatus.DELETED) {
      throw new NotFoundException('Provider not found');
    }
    const channelsByProvider = await this.activeChannelsByProvider(tenantId);
    return {
      ...this.sanitize(provider),
      channels: channelsByProvider.get(provider.id) ?? [],
    };
  }
  @Put(':id')
  @ApiOperation({ summary: 'Update provider configuration' })
  @ApiParam({
    name: 'id',
    description: 'Provider UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiBody({
    type: UpdateProviderDTO,
    examples: {
      rename: {
        summary: 'Renombrar',
        value: { name: 'SMTP corporativo v2' },
      },
      changeConfig: {
        summary: 'Cambiar config (EMAIL)',
        value: { config: PROVIDER_CONFIG_EXAMPLES.email.value },
      },
      rotateSecret: {
        summary: 'Rotar secreto',
        value: { secret: 'nuevo-password-smtp' },
      },
      deactivate: {
        summary: 'Desactivar',
        value: { status: 'INACTIVE' },
      },
      reactivate: {
        summary: 'Reactivar',
        value: { status: 'ACTIVE' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Provider updated',
    example: PROVIDER_RESPONSE_EXAMPLE,
  })
  @ApiResponse({ status: 404, description: 'Provider not found' })
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateProviderDTO,
  ) {
    const tenantId = req.user!.tenantId;
    const existing = await this.repo.findOne({ where: { id, tenantId } });
    if (!existing || existing.status === ProviderStatus.DELETED) {
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
    // status e isActive se mantienen sincronizados:
    // ACTIVE <-> isActive true, INACTIVE/DELETED <-> isActive false.
    if (dto.status !== undefined && dto.status !== ProviderStatus.DELETED) {
      update.status = dto.status;
      update.isActive = dto.status === ProviderStatus.ACTIVE;
    } else if (dto.isActive !== undefined) {
      update.isActive = dto.isActive;
      update.status = dto.isActive
        ? ProviderStatus.ACTIVE
        : ProviderStatus.INACTIVE;
    }

    await this.repo.update({ id, tenantId }, update as Record<string, unknown>);
    await this.registry.invalidateForProvider(tenantId, id);
    const updated = await this.repo.findOne({ where: { id, tenantId } });
    return this.sanitize(updated!);
  }

  @Delete(':id')
  @ApiOperation({
    summary:
      'Delete provider: hard delete if never used in deliveries, else soft delete (status=DELETED)',
    description:
      'Si el proveedor NO está asociado a ninguna notificación (0 deliveries ' +
      'con su provider_id) se elimina de la base de datos. Si ya tiene envíos, ' +
      'solo cambia a status=DELETED (no se devuelve en los GET).',
  })
  @ApiParam({
    name: 'id',
    description: 'Provider UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Provider deleted (hard) or soft-deleted (in use)',
    content: {
      'application/json': {
        examples: {
          hardDelete: {
            summary: 'Borrado físico (sin uso)',
            value: {
              id: '550e8400-e29b-41d4-a716-446655440000',
              deleted: true,
              softDeleted: false,
              usage: 0,
            },
          },
          softDelete: {
            summary: 'Borrado lógico (con envíos)',
            value: {
              id: '550e8400-e29b-41d4-a716-446655440000',
              deleted: false,
              softDeleted: true,
              usage: 3,
              status: 'DELETED',
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Provider not found' })
  async remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const tenantId = req.user!.tenantId;
    const existing = await this.repo.findOne({ where: { id, tenantId } });
    if (!existing || existing.status === ProviderStatus.DELETED) {
      throw new NotFoundException('Provider not found');
    }

    const usage = await this.deliveryRepo.count({
      where: { providerId: id },
    });

    if (usage === 0) {
      // Sin notificaciones asociadas: borrado físico.
      // Los mapeos a canales se eliminan por CASCADE (fk_pchannels_provider).
      await this.channelRepo.delete({ providerId: id, tenantId });
      await this.repo.delete({ id, tenantId });
      await this.registry.invalidateForProvider(tenantId, id);
      return { id, deleted: true, softDeleted: false, usage };
    }

    // En uso: solo marca como eliminado (no se devuelve en GET).
    await this.repo.update(
      { id, tenantId },
      { status: ProviderStatus.DELETED, isActive: false },
    );
    await this.channelRepo.update(
      { providerId: id, tenantId, isActive: true },
      { isActive: false },
    );
    await this.registry.invalidateForProvider(tenantId, id);
    return {
      id,
      deleted: false,
      softDeleted: true,
      usage,
      status: ProviderStatus.DELETED,
    };
  }

  @Post(':id/channels')
  @ApiOperation({
    summary: 'Map provider to a delivery channel (1 active per channel)',
    description:
      'Solo proveedores ACTIVE. Normalmente el canal coincide con el tipo del proveedor.',
  })
  @ApiParam({
    name: 'id',
    description: 'Provider UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiBody({
    type: MapChannelDTO,
    examples: {
      email: { summary: 'EMAIL → EMAIL', value: { channel: 'EMAIL' } },
      sms: { summary: 'SMS → SMS', value: { channel: 'SMS' } },
      whatsapp: {
        summary: 'WHATSAPP → WHATSAPP',
        value: { channel: 'WHATSAPP' },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Provider mapped to channel',
    example: {
      id: '770e8400-e29b-41d4-a716-446655440000',
      providerId: '550e8400-e29b-41d4-a716-446655440000',
      channel: 'EMAIL',
      isActive: true,
      mapped: true,
    },
  })
  @ApiResponse({ status: 404, description: 'Provider not found' })
  async mapChannel(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: MapChannelDTO,
  ) {
    const tenantId = req.user!.tenantId;
    const provider = await this.repo.findOne({ where: { id, tenantId } });
    if (!provider || provider.status === ProviderStatus.DELETED) {
      throw new NotFoundException('Provider not found');
    }
    if (provider.status !== ProviderStatus.ACTIVE || !provider.isActive) {
      throw new BadRequestException(
        'Only ACTIVE providers can be mapped to a channel',
      );
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

  /** Canales con mapeo activo por proveedor (para exponer en GET). */
  private async activeChannelsByProvider(
    tenantId: string,
  ): Promise<Map<string, string[]>> {
    const mappings = await this.channelRepo.find({ where: { tenantId } });
    const byProvider = new Map<string, string[]>();
    for (const m of mappings) {
      if (!m.isActive) continue;
      const list = byProvider.get(m.providerId) ?? [];
      list.push(m.channel);
      byProvider.set(m.providerId, list);
    }
    return byProvider;
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
    // host, port y demás viven en la columna `config` (jsonb, migración 0008).
    // Se expanden a nivel superior para consumo directo; `config` se conserva
    // para el contrato de escritura (POST/PUT). El secreto nunca sale en plano.
    // Los campos explícitos van después para que prevalezcan ante colisiones.
    return {
      ...(provider.config ?? {}),
      id: provider.id,
      tenantId: provider.tenantId,
      name: provider.name,
      providerType: provider.providerType,
      config: provider.config,
      secretRef: encrypted ? '***encrypted***' : provider.secretRef,
      hasSecret: encrypted,
      isActive: provider.isActive,
      status: provider.status ?? ProviderStatus.ACTIVE,
      createdAt: provider.createdAt,
      updatedAt: provider.updatedAt,
    };
  }
}
