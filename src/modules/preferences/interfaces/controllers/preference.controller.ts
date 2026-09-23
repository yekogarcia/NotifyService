import {
  Controller,
  Put,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Req,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import {
  IsEnum,
  IsBoolean,
  IsArray,
  ArrayMinSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { ChannelType } from '../../../notifications/domain/enums';
import { PreferenceEntity } from '../../domain/entities/preference.entity';
import { AuthenticatedRequest } from '../../../../shared/infrastructure/guards/auth.guard';
import { AdminGuard } from '../../../auth/infrastructure/guards/admin.guard';

class PreferenceItemDTO {
  @ApiProperty({ enum: ChannelType })
  @IsEnum(ChannelType)
  channel!: ChannelType;

  @ApiProperty()
  @IsBoolean()
  enabled!: boolean;
}

class SetPreferencesDTO {
  @ApiProperty({ type: [PreferenceItemDTO] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PreferenceItemDTO)
  preferences!: PreferenceItemDTO[];
}

@ApiTags('preferences')
@UseGuards(AdminGuard)
@Controller('preferences')
export class PreferenceController {
  constructor(
    @InjectRepository(PreferenceEntity)
    private readonly preferenceRepo: Repository<PreferenceEntity>,
  ) {}

  @Put(':userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set channel preferences for a user' })
  @ApiBody({ type: SetPreferencesDTO })
  @ApiResponse({ status: 200, description: 'Preferences updated' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async setPreferences(
    @Req() req: AuthenticatedRequest,
    @Param('userId') userId: string,
    @Body() dto: SetPreferencesDTO,
  ) {
    const tenantId = req.user!.tenantId;
    const applicationId = req.user!.sub;

    await this.preferenceRepo.upsert(
      dto.preferences.map((p) => ({
        tenantId,
        applicationId,
        userId,
        channel: p.channel,
        enabled: p.enabled,
      })),
      ['tenantId', 'applicationId', 'userId', 'channel'],
    );

    return { userId, preferences: dto.preferences };
  }

  @Get(':userId')
  @ApiOperation({ summary: 'Get current preferences for a user' })
  @ApiResponse({ status: 200, description: 'User preferences' })
  async getPreferences(
    @Req() req: AuthenticatedRequest,
    @Param('userId') userId: string,
  ) {
    const tenantId = req.user!.tenantId;
    const applicationId = req.user!.sub;

    const preferences = await this.preferenceRepo.find({
      where: { tenantId, applicationId, userId },
    });

    return { userId, preferences };
  }
}
