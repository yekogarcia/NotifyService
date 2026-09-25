import { createHmac } from 'crypto';
import { HandleWhatsappStatusUseCase } from '../../../src/modules/deliveries/application/handle-whatsapp-status.use-case';
import { DeliveryStatus } from '../../../src/modules/notifications/domain/enums';

describe('HandleWhatsappStatusUseCase', () => {
  const oldVerify = process.env.WHATSAPP_VERIFY_TOKEN;
  const oldAppSecret = process.env.WHATSAPP_APP_SECRET;

  function makeUseCase(
    delivery: {
      id: string;
      status: DeliveryStatus;
      providerMessageId?: string;
    } | null,
  ) {
    const repo = {
      findByProviderMessageId: jest.fn().mockResolvedValue(delivery),
      updateStatus: jest.fn().mockResolvedValue(undefined),
    };
    return {
      useCase: new HandleWhatsappStatusUseCase(repo as never),
      repo,
    };
  }

  function payload(
    statuses: {
      id?: string;
      status?: string;
      errors?: { code?: number; title?: string; message?: string }[];
    }[],
  ) {
    return { entry: [{ changes: [{ value: { statuses } }] }] };
  }

  afterEach(() => {
    if (oldVerify === undefined) delete process.env.WHATSAPP_VERIFY_TOKEN;
    else process.env.WHATSAPP_VERIFY_TOKEN = oldVerify;
    if (oldAppSecret === undefined) delete process.env.WHATSAPP_APP_SECRET;
    else process.env.WHATSAPP_APP_SECRET = oldAppSecret;
  });

  describe('parseStatuses', () => {
    it('extracts wamid/status/error from nested payload', () => {
      const { useCase } = makeUseCase(null);
      const updates = useCase.parseStatuses(
        payload([
          {
            id: 'wamid.A',
            status: 'delivered',
          },
          {
            id: 'wamid.B',
            status: 'failed',
            errors: [{ code: 470, message: 'Recipient phone number is not in allowed list.' }],
          },
        ]),
      );

      expect(updates).toEqual([
        { wamid: 'wamid.A', status: 'delivered', errorCode: undefined, errorMessage: undefined },
        {
          wamid: 'wamid.B',
          status: 'failed',
          errorCode: '470',
          errorMessage: 'Recipient phone number is not in allowed list.',
        },
      ]);
    });

    it('returns empty array for empty payload', () => {
      const { useCase } = makeUseCase(null);
      expect(useCase.parseStatuses({})).toEqual([]);
    });
  });

  describe('handle', () => {
    it('updates SENT → DELIVERED on delivered status', async () => {
      const { useCase, repo } = makeUseCase({
        id: 'd1',
        status: DeliveryStatus.SENT,
      });

      const applied = await useCase.handle(
        payload([{ id: 'wamid.X', status: 'delivered' }]),
      );

      expect(applied).toBe(1);
      expect(repo.updateStatus).toHaveBeenCalledWith('d1', DeliveryStatus.DELIVERED);
    });

    it('updates SENT → FAILED on failed status', async () => {
      const { useCase, repo } = makeUseCase({
        id: 'd1',
        status: DeliveryStatus.SENT,
      });

      const applied = await useCase.handle(
        payload([{ id: 'wamid.X', status: 'failed' }]),
      );

      expect(applied).toBe(1);
      expect(repo.updateStatus).toHaveBeenCalledWith('d1', DeliveryStatus.FAILED);
    });

    it('is idempotent when status already matches', async () => {
      const { useCase, repo } = makeUseCase({
        id: 'd1',
        status: DeliveryStatus.DELIVERED,
      });

      const applied = await useCase.handle(
        payload([{ id: 'wamid.X', status: 'delivered' }]),
      );

      expect(applied).toBe(0);
      expect(repo.updateStatus).not.toHaveBeenCalled();
    });

    it('ignores read status (no DeliveryStatus.READ)', async () => {
      const { useCase, repo } = makeUseCase({
        id: 'd1',
        status: DeliveryStatus.DELIVERED,
      });

      const applied = await useCase.handle(
        payload([{ id: 'wamid.X', status: 'read' }]),
      );

      expect(applied).toBe(0);
      expect(repo.updateStatus).not.toHaveBeenCalled();
    });

    it('skips unknown wamid', async () => {
      const { useCase, repo } = makeUseCase(null);

      const applied = await useCase.handle(
        payload([{ id: 'wamid.UNKNOWN', status: 'delivered' }]),
      );

      expect(applied).toBe(0);
      expect(repo.updateStatus).not.toHaveBeenCalled();
    });

    it('rejects invalid transition CREATED → DELIVERED', async () => {
      const { useCase, repo } = makeUseCase({
        id: 'd1',
        status: DeliveryStatus.CREATED,
      });

      const applied = await useCase.handle(
        payload([{ id: 'wamid.X', status: 'delivered' }]),
      );

      expect(applied).toBe(0);
      expect(repo.updateStatus).not.toHaveBeenCalled();
    });
  });

  describe('verifyChallenge', () => {
    it('returns challenge on valid subscribe handshake', () => {
      process.env.WHATSAPP_VERIFY_TOKEN = 'tok123';
      const { useCase } = makeUseCase(null);

      const challenge = useCase.verifyChallenge(
        'subscribe',
        'tok123',
        '987654321',
      );

      expect(challenge).toBe('987654321');
    });

    it('throws on wrong token', () => {
      process.env.WHATSAPP_VERIFY_TOKEN = 'tok123';
      const { useCase } = makeUseCase(null);

      expect(() =>
        useCase.verifyChallenge('subscribe', 'wrong', '987'),
      ).toThrow();
    });

    it('throws when mode is not subscribe', () => {
      process.env.WHATSAPP_VERIFY_TOKEN = 'tok123';
      const { useCase } = makeUseCase(null);

      expect(() =>
        useCase.verifyChallenge('unsubscribe', 'tok123', '987'),
      ).toThrow();
    });
  });

  describe('verifySignature', () => {
    it('accepts valid sha256 signature when app secret configured', () => {
      process.env.WHATSAPP_APP_SECRET = 'app-secret';
      const body = '{"entry":[]}';
      const signature =
        'sha256=' + createHmac('sha256', 'app-secret').update(body).digest('hex');
      const { useCase } = makeUseCase(null);

      expect(() => useCase.verifySignature(body, signature)).not.toThrow();
    });

    it('rejects invalid signature', () => {
      process.env.WHATSAPP_APP_SECRET = 'app-secret';
      const { useCase } = makeUseCase(null);

      expect(() =>
        useCase.verifySignature('{"entry":[]}', 'sha256=deadbeef'),
      ).toThrow();
    });

    it('skips verification when WHATSAPP_APP_SECRET unset', () => {
      delete process.env.WHATSAPP_APP_SECRET;
      const { useCase } = makeUseCase(null);

      expect(() => useCase.verifySignature('anything', undefined)).not.toThrow();
    });
  });
});
