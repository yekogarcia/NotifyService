export interface ProviderResult {
  success: boolean;
  providerMessageId?: string;
  errorType?: string;
  errorMessage?: string;
}

export interface EmailProvider {
  sendEmail(to: string, subject: string, body: string): Promise<ProviderResult>;
}
