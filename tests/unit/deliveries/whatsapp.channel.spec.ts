import { WhatsappChannel } from '../../../src/modules/deliveries/infrastructure/channels/whatsapp.channel';
import { SendContext } from '../../../src/modules/deliveries/domain/channel.interface';

describe('WhatsappChannel', () => {
  const baseContext: SendContext = {
    deliveryId: 'd1',
    tenantId: 't1',
    to: '+573001234567',
    subject: null,
    body: 'Hola',
    language: 'es',
    templateParams: [],
  };

  function makeChannel(options: {
    resolved?: { providerId: string; provider: unknown } | null;
    fallback?: unknown;
  }) {
    const registry = {
      resolve: jest.fn().mockResolvedValue(options.resolved ?? null),
    };
    const fallback = options.fallback ?? {
      sendText: jest.fn().mockResolvedValue({ success: true, providerMessageId: 'wamid.FB' }),
      sendTemplate: jest.fn().mockResolvedValue({ success: true, providerMessageId: 'wamid.FT' }),
    };
    return {
      channel: new WhatsappChannel(
        registry as never,
        fallback as never,
      ),
      registry,
      fallback: fallback as {
        sendText: jest.Mock;
        sendTemplate: jest.Mock;
      },
    };
  }

  it('sends free text when subject is null', async () => {
    const provider = {
      sendText: jest.fn().mockResolvedValue({ success: true, providerMessageId: 'wamid.1' }),
      sendTemplate: jest.fn(),
    };
    const { channel, registry } = makeChannel({
      resolved: { providerId: 'p1', provider },
    });

    const result = await channel.send(baseContext);

    expect(registry.resolve).toHaveBeenCalledWith('t1', 'WHATSAPP');
    expect(provider.sendText).toHaveBeenCalledWith('+573001234567', 'Hola');
    expect(provider.sendTemplate).not.toHaveBeenCalled();
    expect(result).toEqual({
      success: true,
      providerId: 'p1',
      providerMessageId: 'wamid.1',
      errorType: undefined,
      errorMessage: undefined,
    });
  });

  it('sends HSM template when subject holds Meta template name', async () => {
    const provider = {
      sendText: jest.fn(),
      sendTemplate: jest
        .fn()
        .mockResolvedValue({ success: true, providerMessageId: 'wamid.2' }),
    };
    const { channel } = makeChannel({
      resolved: { providerId: 'p1', provider },
    });

    const result = await channel.send({
      ...baseContext,
      subject: 'order_created_es',
      language: 'es',
      templateParams: ['Juan', 'ORD-1'],
      body: 'rendered text ignored for HSM',
    });

    expect(provider.sendTemplate).toHaveBeenCalledWith(
      '+573001234567',
      'order_created_es',
      'es',
      ['Juan', 'ORD-1'],
    );
    expect(result.success).toBe(true);
    expect(result.providerMessageId).toBe('wamid.2');
  });

  it('defaults language to es for HSM when missing', async () => {
    const provider = {
      sendText: jest.fn(),
      sendTemplate: jest.fn().mockResolvedValue({ success: true }),
    };
    const { channel } = makeChannel({
      resolved: { providerId: 'p1', provider },
    });

    await channel.send({
      ...baseContext,
      subject: 'tpl',
      language: undefined,
    });

    expect(provider.sendTemplate).toHaveBeenCalledWith(
      '+573001234567',
      'tpl',
      'es',
      [],
    );
  });

  it('falls back to env provider when no tenant mapping', async () => {
    const { channel, fallback } = makeChannel({ resolved: null });

    const result = await channel.send(baseContext);

    expect(fallback.sendText).toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.providerId).toBeUndefined();
  });

  it('returns ConfigurationError when resolved provider is not a WhatsApp provider', async () => {
    const { channel } = makeChannel({
      resolved: { providerId: 'p1', provider: { sendSms: jest.fn() } },
    });

    const result = await channel.send(baseContext);

    expect(result.success).toBe(false);
    expect(result.errorType).toBe('ConfigurationError');
  });
});
