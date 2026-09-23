import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { Public } from '../../../../shared/infrastructure/guards/public.decorator';
import { OAuthTokenUseCase } from '../../application/use-cases/oauth-token.use-case';
import { OAuthTokenDTO } from '../../application/dto/oauth-token.dto';
import { OAuthRefreshTokenDTO } from '../../application/dto/oauth-refresh-token.dto';

@ApiTags('auth')
@Public()
@Controller('oauth')
export class OAuthController {
  constructor(private readonly oauthTokenUseCase: OAuthTokenUseCase) {}

  @Post('token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'OAuth 2.0 token endpoint',
    description:
      'Obtain access and refresh tokens using OAuth 2.0 grant types: client_credentials, password, or refresh_token',
  })
  @ApiBody({ type: OAuthTokenDTO })
  @ApiResponse({
    status: 200,
    description: 'Tokens generated successfully',
    schema: {
      type: 'object',
      properties: {
        access_token: { type: 'string', example: 'eyJhbGc...' },
        token_type: { type: 'string', example: 'Bearer' },
        expires_in: { type: 'number', example: 3600 },
        refresh_token: { type: 'string', example: 'dGhpcyBpcyBh...' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid grant type or missing parameters',
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async token(@Body() dto: OAuthTokenDTO) {
    return this.oauthTokenUseCase.execute(dto.grant_type, {
      client_id: dto.client_id,
      client_secret: dto.client_secret,
      username: dto.username,
      password: dto.password,
    });
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'OAuth 2.0 refresh token endpoint',
    description:
      'Exchange a valid refresh token for new access and refresh tokens',
  })
  @ApiBody({ type: OAuthRefreshTokenDTO })
  @ApiResponse({
    status: 200,
    description: 'Tokens refreshed successfully',
    schema: {
      type: 'object',
      properties: {
        access_token: { type: 'string', example: 'eyJhbGc...' },
        token_type: { type: 'string', example: 'Bearer' },
        expires_in: { type: 'number', example: 3600 },
        refresh_token: { type: 'string', example: 'dGhpcyBpcyBh...' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Missing required parameters',
  })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refresh(@Body() dto: OAuthRefreshTokenDTO) {
    return this.oauthTokenUseCase.executeRefresh({
      client_id: dto.client_id,
      client_secret: dto.client_secret,
      refresh_token: dto.refresh_token,
    });
  }
}
