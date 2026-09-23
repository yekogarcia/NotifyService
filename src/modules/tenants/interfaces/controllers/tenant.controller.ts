import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { Public } from '../../../../shared/infrastructure/guards/public.decorator';
import {
  CreateTenantUseCase,
  GetTenantsUseCase,
  GetTenantByIdUseCase,
  UpdateTenantUseCase,
  DeleteTenantUseCase,
} from '../../application/use-cases/tenant.use-cases';
import {
  CreateTenantDTO,
  UpdateTenantDTO,
} from '../../application/dto/tenant.dto';
@ApiTags('tenants')
@Public()
@Controller('tenants')
export class TenantController {
  constructor(
    private readonly createTenant: CreateTenantUseCase,
    private readonly getTenants: GetTenantsUseCase,
    private readonly getTenantById: GetTenantByIdUseCase,
    private readonly updateTenant: UpdateTenantUseCase,
    private readonly deleteTenant: DeleteTenantUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new tenant' })
  @ApiResponse({ status: 201, description: 'Tenant created successfully' })
  async create(@Body() dto: CreateTenantDTO) {
    return this.createTenant.execute(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all tenants' })
  @ApiResponse({ status: 200, description: 'List of tenants' })
  async findAll() {
    return this.getTenants.execute();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get tenant by ID' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Tenant found' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.getTenantById.execute(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update tenant' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Tenant updated' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTenantDTO,
  ) {
    return this.updateTenant.execute(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete tenant' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 204, description: 'Tenant deleted' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.deleteTenant.execute(id);
  }
}
