import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsOptional,
  ValidateNested,
  ArrayMinSize,
  IsEnum,
  ValidateIf,
  IsEmail,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ChannelType, RecipientType } from '../../../notifications/domain/enums';

export class RecipientDTO {
  @ApiProperty({ enum: RecipientType })
  @IsEnum(RecipientType)
  recipientType: RecipientType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;
}

export class CreateNotificationDTO {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  sourceSystem: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  eventType: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  idempotencyKey: string;

  @ApiPropertyOptional({ type: RecipientDTO })
  @IsOptional()
  @ValidateNested()
  @Type(() => RecipientDTO)
  recipient?: RecipientDTO;

  @ApiPropertyOptional({ type: [RecipientDTO] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RecipientDTO)
  recipients?: RecipientDTO[];

  @ApiProperty({ enum: ChannelType, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(ChannelType, { each: true })
  channels: ChannelType[];

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  templateCode: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional({ type: 'object' })
  @IsOptional()
  data?: Record<string, unknown>;
}
