import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsArray, ValidateNested, ArrayMinSize, IsEnum, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateTemplateUseCase } from '../../application/use-cases/create-template.use-case';
import { UpdateTemplateVersionUseCase } from '../../application/use-cases/update-template-version.use-case';
import { GetTemplateUseCase } from '../../application/use-cases/get-template.use-case';
import { ChannelType } from '../../../notifications/domain/enums';

class TemplateVersionDTO {
  @ApiProperty({ example: 1 })
  @IsNumber()
  version!: number;

  @ApiProperty({ example: 'es' })
  @IsString()
  @IsNotEmpty()
  language!: string;

  @ApiProperty({ enum: ChannelType, example: ChannelType.EMAIL })
  @IsEnum(ChannelType)
  channel!: ChannelType;

  @ApiPropertyOptional({ example: 'Bienvenido' })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiProperty({ example: 'Hola {{userName}}, bienvenido a nuestra plataforma.' })
  @IsString()
  @IsNotEmpty()
  body!: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  isActive?: boolean;
}

class CreateTemplateDTO {
  @ApiProperty({ example: 'welcome-email' })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiPropertyOptional({ example: 'Template de bienvenida por email' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ type: [TemplateVersionDTO] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TemplateVersionDTO)
  versions!: TemplateVersionDTO[];
}

@ApiTags('templates')
@Controller('templates')
export class TemplateController {
  constructor(
    private readonly createTemplate: CreateTemplateUseCase,
    private readonly updateVersion: UpdateTemplateVersionUseCase,
    private readonly getTemplate: GetTemplateUseCase,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new template with versions' })
  @ApiBody({ type: CreateTemplateDTO })
  @ApiResponse({ status: 201, description: 'Template created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async create(@Body() input: CreateTemplateDTO) {
    return this.createTemplate.execute(input as any);
  }

  @Get(':code')
  @ApiOperation({ summary: 'Get template with all versions' })
  @ApiParam({ name: 'code', description: 'Template unique code', example: 'welcome-email' })
  @ApiResponse({ status: 200, description: 'Template found' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async findOne(@Param('code') code: string) {
    return this.getTemplate.execute('default-tenant', code);
  }

  @Patch(':code/versions/:version/activate')
  @ApiOperation({ summary: 'Activate a specific template version' })
  @ApiParam({ name: 'code', description: 'Template unique code', example: 'welcome-email' })
  @ApiParam({ name: 'version', description: 'Version number', example: 1 })
  @ApiQuery({ name: 'language', description: 'Language code', example: 'es' })
  @ApiQuery({ name: 'channel', description: 'Channel type', enum: ChannelType })
  @ApiResponse({ status: 200, description: 'Version activated' })
  @ApiResponse({ status: 400, description: 'Version not found' })
  async activate(
    @Param('code') code: string,
    @Param('version') version: number,
    @Query('language') language: string,
    @Query('channel') channel: string,
  ) {
    return this.updateVersion.activate(code, version, language, channel as ChannelType);
  }
}
