import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class OAuthRefreshTokenDTO {
  @ApiProperty({
    description: 'Application client_id',
    example: 'app_abc123',
  })
  @IsString()
  @IsNotEmpty()
  client_id!: string;

  @ApiProperty({
    description: 'Application client_secret',
    example: 'sec_xyz789',
  })
  @IsString()
  @IsNotEmpty()
  client_secret!: string;

  @ApiProperty({
    description: 'Refresh token to exchange for new tokens',
    example: 'dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4',
  })
  @IsString()
  @IsNotEmpty()
  refresh_token!: string;
}
