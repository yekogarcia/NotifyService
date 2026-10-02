import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { AdminGuard } from '../../../auth/infrastructure/guards/admin.guard';
import { AuthenticatedRequest } from '../../../../shared/infrastructure/guards/auth.guard';
import {
  CreateApplicationUseCase,
  GetApplicationsUseCase,
  GetApplicationByIdUseCase,
  UpdateApplicationUseCase,
  DeleteApplicationUseCase,
  RotateSecretUseCase,
} from '../../application/use-cases/application.use-cases';
import {
  CreateApplicationDTO,
  UpdateApplicationDTO,
} from '../../application/dto/application.dto';

@ApiTags('applications')
@UseGuards(AdminGuard)
@Controller('applications')
export class ApplicationController {
  constructor(
    private readonly createApp: CreateApplicationUseCase,
    private readonly getApps: GetApplicationsUseCase,
    private readonly getAppById: GetApplicationByIdUseCase,
    private readonly updateApp: UpdateApplicationUseCase,
    private readonly deleteApp: DeleteApplicationUseCase,
    private readonly rotateSecret: RotateSecretUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Create application (tenant from JWT; returns client_id and client_secret)',
  })
  @ApiResponse({
    status: 201,
    description: 'Application created with credentials',
  })
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateApplicationDTO,
  ) {
    return this.createApp.execute(req.user!.tenantId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List applications for tenant (from JWT)' })
  @ApiResponse({ status: 200, description: 'List of applications' })
  async findAll(@Req() req: AuthenticatedRequest) {
    return this.getApps.execute(req.user!.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get application by ID' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Application found' })
  @ApiResponse({ status: 404, description: 'Application not found' })
  async findOne(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.getAppById.execute(req.user!.tenantId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update application' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Application updated' })
  @ApiResponse({ status: 404, description: 'Application not found' })
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateApplicationDTO,
  ) {
    return this.updateApp.execute(req.user!.tenantId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete application (only if it has no associated records)',
    description:
      'Solo se elimina si la aplicación NO está asociada a notificaciones, ' +
      'plantillas, preferencias, dispositivos, eventos ni tokens (los FK son ' +
      'ON DELETE CASCADE). Si tiene algo asociado responde 409 con el detalle ' +
      'de lo que la bloquea.',
  })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 204, description: 'Application deleted' })
  @ApiResponse({ status: 404, description: 'Application not found' })
  @ApiResponse({
    status: 409,
    description: 'Application has associated records and cannot be deleted',
    example: {
      message:
        'Cannot delete application with associated records: notifications (2), templates (1)',
      blocking: { notifications: 2, templates: 1 },
    },
  })
  async remove(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.deleteApp.execute(req.user!.tenantId, id);
  }

  @Post(':id/rotate-secret')
  @ApiOperation({ summary: 'Rotate client_secret for application' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'New credentials generated' })
  @ApiResponse({ status: 404, description: 'Application not found' })
  async rotate(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.rotateSecret.execute(req.user!.tenantId, id);
  }
}
