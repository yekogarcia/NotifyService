export interface SendResult {
  success: boolean;
  providerMessageId?: string;
  errorType?: string;
  errorMessage?: string;
}

export interface NotificationChannel {
  send(
    deliveryId: string,
    to: string,
    subject: string | null,
    body: string,
  ): Promise<SendResult>;
}
