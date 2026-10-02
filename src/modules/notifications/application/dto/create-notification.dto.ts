import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsOptional,
  IsUUID,
  ValidateNested,
  ArrayMinSize,
  IsEnum,
  IsEmail,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ChannelType,
  RecipientType,
} from '../../../notifications/domain/enums';

export class RecipientDTO {
  @ApiProperty({ enum: RecipientType })
  @IsEnum(RecipientType)
  recipientType!: RecipientType;

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
  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description:
      'Application UUID. Obligatorio con token admin (login password); ' +
      'con token client_credentials se toma del JWT (si se envía debe coincidir). ' +
      'La aplicación debe pertenecer al tenant del token.',
  })
  @IsOptional()
  @IsUUID()
  applicationId?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  sourceSystem!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  eventType!: string;

  @ApiPropertyOptional({
    example: 'res-1001',
    description:
      'Clave anti-duplicados (única por tenant+app). Si se reintenta crear ' +
      'con la misma clave, responde la notificación existente sin duplicar ' +
      'envíos. Opcional: si se omite, el servidor genera un UUID.',
  })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;

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
  channels!: ChannelType[];

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  templateCode!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional({ type: 'object' })
  @IsOptional()
  data?: Record<string, unknown>;
}
