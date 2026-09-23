import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class CreateApplicationDTO {
  @ApiProperty({ example: 'App SMS' })
  @IsString()
  @IsNotEmpty()
  name!: string;
}

export class UpdateApplicationDTO {
  @ApiPropertyOptional({ example: 'App SMS Updated' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class ApplicationResponseDTO {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  tenantId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  clientId!: string;

  @ApiProperty()
  clientSecret!: string;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  createdAt!: Date;
}

export class LoginDTO {
  @ApiProperty({ example: 'app_abc123' })
  @IsString()
  @IsNotEmpty()
  clientId!: string;

  @ApiProperty({ example: 'secret_xyz789' })
  @IsString()
  @IsNotEmpty()
  clientSecret!: string;
}

export class TokenResponseDTO {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty()
  expiresIn!: number;

  @ApiProperty()
  tokenType!: string;
}
