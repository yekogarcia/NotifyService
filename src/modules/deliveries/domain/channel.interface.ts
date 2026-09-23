export interface SendResult {
  success: boolean;
  providerId?: string;
  providerMessageId?: string;
  errorType?: string;
  errorMessage?: string;
}

export interface SendContext {
  deliveryId: string;
  tenantId: string;
  to: string;
  subject: string | null;
  body: string;
}

export interface NotificationChannel {
  send(context: SendContext): Promise<SendResult>;
}
