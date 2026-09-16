import {
  Controller,
  Put,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
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
    @Param('userId') userId: string,
    @Body() dto: SetPreferencesDTO,
  ) {
    const tenantId = 'default-tenant';

    await this.preferenceRepo.upsert(
      dto.preferences.map((p) => ({
        tenantId,
        userId,
        channel: p.channel,
        enabled: p.enabled,
      })),
      ['tenantId', 'userId', 'channel'],
    );

    return { userId, preferences: dto.preferences };
  }

  @Get(':userId')
  @ApiOperation({ summary: 'Get current preferences for a user' })
  @ApiResponse({ status: 200, description: 'User preferences' })
  async getPreferences(@Param('userId') userId: string) {
    const tenantId = 'default-tenant';

    const preferences = await this.preferenceRepo.find({
      where: { tenantId, userId },
    });

    return { userId, preferences };
  }
}
