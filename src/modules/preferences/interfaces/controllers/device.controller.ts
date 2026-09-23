import {
  Controller,
  Post,
  Delete,
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
import { IsString, IsNotEmpty, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Platform } from '../../../notifications/domain/enums';
import { DeviceEntity } from '../../domain/entities/device.entity';
import { AuthenticatedRequest } from '../../../../shared/infrastructure/guards/auth.guard';
import { AdminGuard } from '../../../auth/infrastructure/guards/admin.guard';

class RegisterDeviceDTO {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  deviceToken!: string;

  @ApiProperty({ enum: Platform })
  @IsEnum(Platform)
  platform!: Platform;
}

@ApiTags('devices')
@UseGuards(AdminGuard)
@Controller('devices')
export class DeviceController {
  constructor(
    @InjectRepository(DeviceEntity)
    private readonly deviceRepo: Repository<DeviceEntity>,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a device token' })
  @ApiBody({ type: RegisterDeviceDTO })
  @ApiResponse({ status: 201, description: 'Device registered' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async register(
    @Req() req: AuthenticatedRequest,
    @Body() dto: RegisterDeviceDTO,
  ) {
    const tenantId = req.user!.tenantId;
    const applicationId = req.user!.sub;

    await this.deviceRepo.upsert(
      {
        tenantId,
        applicationId,
        userId: dto.userId,
        deviceToken: dto.deviceToken,
        platform: dto.platform,
        isActive: true,
      },
      ['tenantId', 'applicationId', 'deviceToken'],
    );

    return {
      userId: dto.userId,
      deviceToken: dto.deviceToken,
      platform: dto.platform,
      isActive: true,
    };
  }

  @Delete(':token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unregister a device token' })
  @ApiResponse({ status: 200, description: 'Device unregistered' })
  async unregister(
    @Req() req: AuthenticatedRequest,
    @Param('token') token: string,
  ) {
    const tenantId = req.user!.tenantId;
    const applicationId = req.user!.sub;

    await this.deviceRepo.update(
      { tenantId, applicationId, deviceToken: token },
      { isActive: false },
    );

    return { deviceToken: token, isActive: false };
  }
}
