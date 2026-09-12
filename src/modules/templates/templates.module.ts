import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TemplateController } from './interfaces/controllers/template.controller';
import { NotificationTemplateEntity } from './domain/entities/template.entity';
import { NotificationTemplateVersionEntity } from './domain/entities/template-version.entity';
import { CreateTemplateUseCase } from './application/use-cases/create-template.use-case';
import { UpdateTemplateVersionUseCase } from './application/use-cases/update-template-version.use-case';
import { GetTemplateUseCase } from './application/use-cases/get-template.use-case';
import { HandlebarsRenderer } from './infrastructure/handlebars-renderer';
import { ValidateVariablesUseCase } from './application/validate-variables';
import { LocaleResolverUseCase } from './application/locale-resolver';
import { TemplateRenderer } from './application/template-renderer';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      NotificationTemplateEntity,
      NotificationTemplateVersionEntity,
    ]),
  ],
  controllers: [TemplateController],
  providers: [
    {
      provide: 'TemplateRenderer',
      useClass: HandlebarsRenderer,
    },
    {
      provide: CreateTemplateUseCase,
      useFactory: (dataSource) => new CreateTemplateUseCase(dataSource),
      inject: ['DataSource'],
    },
    UpdateTemplateVersionUseCase,
    GetTemplateUseCase,
    ValidateVariablesUseCase,
    LocaleResolverUseCase,
    HandlebarsRenderer,
  ],
  exports: ['TemplateRenderer', LocaleResolverUseCase, ValidateVariablesUseCase],
})
export class TemplatesModule {}
