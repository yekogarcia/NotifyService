import { Injectable } from '@nestjs/common';
import { TemplateRenderer } from '../application/template-renderer';

@Injectable()
export class HandlebarsRenderer implements TemplateRenderer {
  render(template: string, data: Record<string, unknown>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
      const value = data[key];
      return value !== undefined ? String(value) : match;
    });
  }

  extractVariables(template: string): string[] {
    const matches = template.match(/\{\{(\w+)\}\}/g);
    if (!matches) return [];
    const vars = matches.map((m) => m.replace(/\{\{|\}\}/g, ''));
    return [...new Set(vars)];
  }
}
