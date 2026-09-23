import { Injectable, Logger, Inject } from '@nestjs/common';
import { TemplateRenderer } from '../application/template-renderer';

@Injectable()
export class ValidateVariablesUseCase {
  private readonly logger = new Logger(ValidateVariablesUseCase.name);

  constructor(
    @Inject('TemplateRenderer') private readonly renderer: TemplateRenderer,
  ) {}

  execute(
    template: string,
    data: Record<string, unknown>,
  ): { valid: boolean; missing: string[] } {
    const required = this.renderer.extractVariables(template);
    const missing: string[] = [];

    for (const varName of required) {
      if (data[varName] === undefined) {
        missing.push(varName);
      }
    }

    if (missing.length > 0) {
      this.logger.warn(`Missing template variables: ${missing.join(', ')}`);
    }

    return { valid: missing.length === 0, missing };
  }
}
