import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsIn, ValidateIf } from 'class-validator';

export class OAuthTokenDTO {
  @ApiProperty({
    description: 'OAuth 2.0 grant type',
    enum: ['client_credentials', 'password'],
    example: 'client_credentials',
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['client_credentials', 'password'])
  grant_type!: 'client_credentials' | 'password';

  @ApiPropertyOptional({
    description:
      'Application client_id (required for client_credentials grant)',
    example: 'app_abc123',
  })
  @ValidateIf((dto) => dto.grant_type === 'client_credentials')
  @IsString()
  @IsNotEmpty()
  client_id?: string;

  @ApiPropertyOptional({
    description:
      'Application client_secret (required for client_credentials grant)',
    example: 'sec_xyz789',
  })
  @ValidateIf((dto) => dto.grant_type === 'client_credentials')
  @IsString()
  @IsNotEmpty()
  client_secret?: string;

  @ApiPropertyOptional({
    description: 'Admin email (required for password grant)',
    example: 'admin@banco-xyz.com',
  })
  @ValidateIf((dto) => dto.grant_type === 'password')
  @IsString()
  @IsNotEmpty()
  username?: string;

  @ApiPropertyOptional({
    description: 'Admin password (required for password grant)',
    example: 'SecureP@ss123',
  })
  @ValidateIf((dto) => dto.grant_type === 'password')
  @IsString()
  @IsNotEmpty()
  password?: string;
}
