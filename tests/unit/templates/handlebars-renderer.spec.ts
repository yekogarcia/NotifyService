import { HandlebarsRenderer } from '../../../src/modules/templates/infrastructure/handlebars-renderer';

describe('HandlebarsRenderer', () => {
  const renderer = new HandlebarsRenderer();

  it('should render simple variables', () => {
    const result = renderer.render(
      'Hello {{name}}',
      { name: 'World' },
    );
    expect(result).toBe('Hello World');
  });

  it('should render multiple variables', () => {
    const result = renderer.render(
      '{{reservationCode}} - {{guestName}}',
      { reservationCode: 'RES-1001', guestName: 'Juan' },
    );
    expect(result).toBe('RES-1001 - Juan');
  });

  it('should leave unresolvable variables as-is', () => {
    const result = renderer.render(
      'Hello {{unknown}}',
      {},
    );
    expect(result).toBe('Hello {{unknown}}');
  });

  it('should extract variable names from template', () => {
    const vars = renderer.extractVariables(
      'Hello {{name}}, code {{code}} and {{name}} again',
    );
    expect(vars).toEqual(['name', 'code']);
  });

  it('should return empty array for template without variables', () => {
    const vars = renderer.extractVariables('No variables here');
    expect(vars).toEqual([]);
  });
});
