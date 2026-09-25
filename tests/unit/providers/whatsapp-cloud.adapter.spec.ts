import { WhatsAppCloudAdapter } from '../../../src/modules/providers/infrastructure/adapters/whatsapp-cloud.adapter';

describe('WhatsAppCloudAdapter', () => {
  const config = {
    phoneNumberId: '108999887766',
    accessToken: 'test-token',
    apiVersion: 'v21.0',
  };

  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    delete (global as { fetch?: unknown }).fetch;
  });

  it('sends text message and returns wamid', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ messages: [{ id: 'wamid.ABC123' }] }),
    });

    const adapter = new WhatsAppCloudAdapter(config);
    const result = await adapter.sendText('+573001234567', 'Hola mundo');

    expect(result.success).toBe(true);
    expect(result.providerMessageId).toBe('wamid.ABC123');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      'https://graph.facebook.com/v21.0/108999887766/messages',
    );
    expect(init.headers.Authorization).toBe('Bearer test-token');
    const body = JSON.parse(init.body);
    expect(body.type).toBe('text');
    expect(body.to).toBe('+573001234567');
    expect(body.text.body).toBe('Hola mundo');
    expect(body.messaging_product).toBe('whatsapp');
  });

  it('sends template message with body params', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ messages: [{ id: 'wamid.TPL1' }] }),
    });

    const adapter = new WhatsAppCloudAdapter(config);
    const result = await adapter.sendTemplate(
      '+573001234567',
      'order_created_es',
      'es',
      ['Juan', 'ORD-42'],
    );

    expect(result.success).toBe(true);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.type).toBe('template');
    expect(body.template.name).toBe('order_created_es');
    expect(body.template.language).toEqual({ code: 'es' });
    expect(body.template.components).toEqual([
      {
        type: 'body',
        parameters: [
          { type: 'text', text: 'Juan' },
          { type: 'text', text: 'ORD-42' },
        ],
      },
    ]);
  });

  it('omits components when template has no params', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ messages: [{ id: 'wamid.TPL2' }] }),
    });

    const adapter = new WhatsAppCloudAdapter(config);
    await adapter.sendTemplate('+573001234567', 'hello_world', 'es', []);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.template.components).toBeUndefined();
  });

  it('returns failure on Meta HTTP error', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({
        error: {
          message: '(#131030) Template not found',
          error_data: { details: 'Template language mismatch' },
        },
      }),
    });

    const adapter = new WhatsAppCloudAdapter(config);
    const result = await adapter.sendTemplate(
      '+573001234567',
      'missing_tpl',
      'es',
      [],
    );

    expect(result.success).toBe(false);
    expect(result.errorType).toBe('HTTP_400');
    expect(result.errorMessage).toBe('Template language mismatch');
  });

  it('returns NETWORK_ERROR on fetch rejection', async () => {
    fetchMock.mockRejectedValue(new Error('connect ETIMEDOUT'));

    const adapter = new WhatsAppCloudAdapter(config);
    const result = await adapter.sendText('+573001234567', 'hola');

    expect(result.success).toBe(false);
    expect(result.errorType).toBe('NETWORK_ERROR');
    expect(result.errorMessage).toBe('connect ETIMEDOUT');
  });

  it('defaults apiVersion to v21.0', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ messages: [{ id: 'wamid.X' }] }),
    });

    const adapter = new WhatsAppCloudAdapter({
      phoneNumberId: '1',
      accessToken: 't',
    });
    await adapter.sendText('+10000000000', 'x');

    expect(fetchMock.mock.calls[0][0]).toContain('/v21.0/');
  });
});
