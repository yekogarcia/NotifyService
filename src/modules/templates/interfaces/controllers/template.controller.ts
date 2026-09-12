import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { CreateTemplateUseCase, CreateTemplateInput } from '../../application/use-cases/create-template.use-case';
import { UpdateTemplateVersionUseCase } from '../../application/use-cases/update-template-version.use-case';
import { GetTemplateUseCase } from '../../application/use-cases/get-template.use-case';

@ApiTags('templates')
@Controller('templates')
export class TemplateController {
  constructor(
    private readonly createTemplate: CreateTemplateUseCase,
    private readonly updateVersion: UpdateTemplateVersionUseCase,
    private readonly getTemplate: GetTemplateUseCase,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new template' })
  async create(@Body() input: CreateTemplateInput) {
    return this.createTemplate.execute(input);
  }

  @Get(':code')
  @ApiOperation({ summary: 'Get template with versions' })
  async findOne(@Param('code') code: string) {
    return this.getTemplate.execute('default-tenant', code);
  }

  @Patch(':code/versions/:version/activate')
  @ApiOperation({ summary: 'Activate a template version' })
  async activate(
    @Param('code') code: string,
    @Param('version') version: number,
    @Query('language') language: string,
    @Query('channel') channel: string,
  ) {
    return this.updateVersion.activate(code, version, language, channel);
  }
}
