export interface TemplateRenderer {
  render(template: string, data: Record<string, unknown>): string;
  extractVariables(template: string): string[];
}
