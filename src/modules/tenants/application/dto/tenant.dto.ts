import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsEmail,
  MinLength,
  Matches,
} from 'class-validator';

export class CreateTenantDTO {
  @ApiProperty({ example: 'Banco XYZ' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'banco-xyz' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'slug must be lowercase alphanumeric with hyphens only',
  })
  slug!: string;

  @ApiProperty({ example: 'admin@banco-xyz.com' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: 'SecureP@ss123' })
  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: 'password must be at least 8 characters' })
  password!: string;
}

export class UpdateTenantDTO {
  @ApiPropertyOptional({ example: 'Banco XYZ Updated' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
