import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Req,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { FastifyReply } from 'fastify';
import { Public } from '../../../../shared/infrastructure/guards/public.decorator';
import {
  HandleWhatsappStatusUseCase,
  WhatsappWebhookPayload,
} from '../../application/handle-whatsapp-status.use-case';

@ApiTags('webhooks')
@Public()
@Controller('webhooks/whatsapp')
export class WhatsappWebhookController {
  constructor(private readonly handler: HandleWhatsappStatusUseCase) {}

  @Get()
  @ApiOperation({ summary: 'Meta WhatsApp webhook verification handshake' })
  @ApiQuery({ name: 'hub.mode', required: false })
  @ApiQuery({ name: 'hub.verify_token', required: false })
  @ApiQuery({ name: 'hub.challenge', required: false })
  verify(
    @Res() res: FastifyReply,
    @Query('hub.mode') mode?: string,
    @Query('hub.verify_token') token?: string,
    @Query('hub.challenge') challenge?: string,
  ): void {
    try {
      const result = this.handler.verifyChallenge(mode, token, challenge);
      res.type('text/plain').send(result);
    } catch {
      throw new BadRequestException('Verification failed');
    }
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Meta WhatsApp status webhook (sent/delivered/failed)',
  })
  async receive(
    @Body() payload: WhatsappWebhookPayload,
    @Headers('x-hub-signature-256') signature?: string,
    @Req() req?: { rawBody?: Buffer | string },
  ) {
    const raw = req?.rawBody;
    if (raw !== undefined && raw !== null) {
      this.handler.verifySignature(
        typeof raw === 'string' ? raw : raw.toString('utf8'),
        signature,
      );
    } else {
      this.handler.verifySignature(JSON.stringify(payload), signature);
    }

    const applied = await this.handler.handle(payload);
    return { received: true, applied };
  }
}
