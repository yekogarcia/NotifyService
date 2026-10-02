import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  IsEnum,
  IsEmail,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateTemplateUseCase } from '../../application/use-cases/create-template.use-case';
import { UpdateTemplateVersionUseCase } from '../../application/use-cases/update-template-version.use-case';
import { GetTemplateUseCase } from '../../application/use-cases/get-template.use-case';
import {
  UpdateTemplateUseCase,
  DeleteTemplateUseCase,
} from '../../application/use-cases/manage-template.use-case';
import {
  ChannelType,
  TemplateStatus,
} from '../../../notifications/domain/enums';
import { AuthenticatedRequest } from '../../../../shared/infrastructure/guards/auth.guard';
import { AdminGuard } from '../../../auth/infrastructure/guards/admin.guard';

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

  @ApiProperty({
    example: 'Hola {{userName}}, bienvenido a nuestra plataforma.',
  })
  @IsString()
  @IsNotEmpty()
  body!: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  isActive?: boolean;
}

class UpdateTemplateVersionContentDTO {
  @ApiPropertyOptional({ example: 'Bienvenido' })
  @IsOptional()
  @IsString()
  subject?: string | null;

  @ApiPropertyOptional({
    example: 'Hola {{userName}}, bienvenido a nuestra plataforma.',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  body?: string;

  @ApiPropertyOptional({
    example: 'en',
    description: 'Cambiar el idioma de la versión (respeta unicidad).',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  language?: string;

  @ApiPropertyOptional({
    enum: ChannelType,
    example: ChannelType.WHATSAPP,
    description: 'Cambiar el canal de la versión (respeta unicidad).',
  })
  @IsOptional()
  @IsEnum(ChannelType)
  channel?: ChannelType;
}

class CreateTemplateDTO {
  @ApiProperty({ example: 'app_abc123' })
  @IsString()
  @IsNotEmpty()
  applicationId!: string;

  @ApiProperty({ example: 'welcome-email' })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiPropertyOptional({ example: 'Template de bienvenida por email' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: 'soporte@semic.com.co',
    description:
      'Remitente de esta plantilla (solo canal EMAIL). Si se omite se usa el fromAddress del proveedor.',
  })
  @IsOptional()
  @IsEmail()
  fromEmail?: string;

  @ApiProperty({ type: [TemplateVersionDTO] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TemplateVersionDTO)
  versions!: TemplateVersionDTO[];
}

class UpdateTemplateDTO {
  @ApiPropertyOptional({ example: 'Template de bienvenida (v2)' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    enum: TemplateStatus,
    example: TemplateStatus.INACTIVE,
    description:
      'ACTIVE = la plantilla se puede usar al enviar; INACTIVE = bloquea el envío con ese código.',
  })
  @IsOptional()
  @IsEnum(TemplateStatus)
  status?: TemplateStatus;

  @ApiPropertyOptional({
    example: 'ventas@semic.com.co',
    description:
      'Remitente (solo EMAIL). null o "" = volver al fromAddress del proveedor.',
  })
  @IsOptional()
  @IsEmail()
  fromEmail?: string | null;
}

@ApiTags('templates')
@UseGuards(AdminGuard)
@Controller('templates')
export class TemplateController {
  constructor(
    private readonly createTemplate: CreateTemplateUseCase,
    private readonly updateVersion: UpdateTemplateVersionUseCase,
    private readonly getTemplate: GetTemplateUseCase,
    private readonly updateTemplate: UpdateTemplateUseCase,
    private readonly deleteTemplate: DeleteTemplateUseCase,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new template with versions' })
  @ApiBody({ type: CreateTemplateDTO })
  @ApiResponse({ status: 201, description: 'Template created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() input: CreateTemplateDTO,
  ) {
    const tenantId = req.user!.tenantId;
    return this.createTemplate.execute({ ...input, tenantId });
  }

  @Get()
  @ApiOperation({ summary: 'List all templates with versions' })
  @ApiResponse({ status: 200, description: 'List of templates' })
  async findAll(@Req() req: AuthenticatedRequest) {
    const tenantId = req.user!.tenantId;
    return this.getTemplate.list(tenantId);
  }

  @Get(':code')
  @ApiOperation({ summary: 'Get template with all versions' })
  @ApiParam({
    name: 'code',
    description: 'Template unique code',
    example: 'welcome-email',
  })
  @ApiResponse({ status: 200, description: 'Template found' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async findOne(@Req() req: AuthenticatedRequest, @Param('code') code: string) {
    const tenantId = req.user!.tenantId;
    return this.getTemplate.execute(tenantId, code);
  }

  @Patch(':code')
  @ApiOperation({
    summary: 'Update template (description / activate-deactivate via status)',
    description:
      'status ACTIVE = se puede usar al enviar; INACTIVE = bloquea el envío ' +
      'con ese código. Si el código existe en varias apps del tenant, pasar ' +
      '?applicationId=<uuid>.',
  })
  @ApiParam({
    name: 'code',
    description: 'Template unique code',
    example: 'welcome-email',
  })
  @ApiQuery({ name: 'applicationId', required: false, type: String })
  @ApiBody({ type: UpdateTemplateDTO })
  @ApiResponse({ status: 200, description: 'Template updated' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  @ApiResponse({
    status: 409,
    description: 'Code exists in several applications; specify applicationId',
  })
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('code') code: string,
    @Query('applicationId') applicationId: string | undefined,
    @Body() input: UpdateTemplateDTO,
  ) {
    const tenantId = req.user!.tenantId;
    return this.updateTemplate.execute(tenantId, code, input, applicationId);
  }

  @Delete(':code')
  @ApiOperation({
    summary: 'Delete template + versions (only if no notification uses it)',
    description:
      'Solo se elimina si ninguna notificación usa ese código (las ' +
      'notificaciones referencian por template_code). Las versiones se ' +
      'eliminan en cascada. Si tiene uso responde 409 con el conteo.',
  })
  @ApiParam({
    name: 'code',
    description: 'Template unique code',
    example: 'welcome-email',
  })
  @ApiQuery({ name: 'applicationId', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'Template and versions deleted',
    example: {
      id: '550e8400-e29b-41d4-a716-446655440000',
      code: 'welcome-email',
      deleted: true,
      usage: 0,
    },
  })
  @ApiResponse({ status: 404, description: 'Template not found' })
  @ApiResponse({
    status: 409,
    description: 'Template is used by notifications',
    example: {
      message:
        'Cannot delete template "welcome-email" with 3 associated notification(s)',
      usage: 3,
    },
  })
  async remove(
    @Req() req: AuthenticatedRequest,
    @Param('code') code: string,
    @Query('applicationId') applicationId: string | undefined,
  ) {
    const tenantId = req.user!.tenantId;
    return this.deleteTemplate.execute(tenantId, code, applicationId);
  }

  @Patch(':code/versions/:version')
  @ApiOperation({ summary: 'Update subject/body of a template version' })
  @ApiParam({
    name: 'code',
    description: 'Template unique code',
    example: 'welcome-email',
  })
  @ApiParam({ name: 'version', description: 'Version number', example: 1 })
  @ApiResponse({ status: 200, description: 'Version updated' })
  @ApiResponse({ status: 400, description: 'Version not found' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async updateContent(
    @Req() req: AuthenticatedRequest,
    @Param('code') code: string,
    @Param('version') version: number,
    @Query('language') language: string,
    @Query('channel') channel: string,
    @Body() input: UpdateTemplateVersionContentDTO,
  ) {
    const tenantId = req.user!.tenantId;
    const template = await this.getTemplate.execute(tenantId, code);
    return this.updateVersion.updateContent(
      template.id,
      version,
      language,
      channel as ChannelType,
      input,
    );
  }

  @Patch(':code/versions/:version/activate')
  @ApiOperation({ summary: 'Activate a specific template version' })
  @ApiParam({
    name: 'code',
    description: 'Template unique code',
    example: 'welcome-email',
  })
  @ApiParam({ name: 'version', description: 'Version number', example: 1 })
  @ApiQuery({ name: 'language', description: 'Language code', example: 'es' })
  @ApiQuery({ name: 'channel', description: 'Channel type', enum: ChannelType })
  @ApiQuery({ name: 'applicationId', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Version activated' })
  @ApiResponse({ status: 400, description: 'Version not found' })
  async activate(
    @Req() req: AuthenticatedRequest,
    @Param('code') code: string,
    @Param('version') version: number,
    @Query('language') language: string,
    @Query('channel') channel: string,
    @Query('applicationId') applicationId: string | undefined,
  ) {
    const tenantId = req.user!.tenantId;
    const template = await this.updateTemplate.resolve(
      tenantId,
      code,
      applicationId,
    );
    return this.updateVersion.activate(
      template.id,
      version,
      language,
      channel as ChannelType,
    );
  }
}
