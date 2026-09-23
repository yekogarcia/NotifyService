import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantEntity } from './domain/entities/tenant.entity';
import { TenantRepositoryImpl } from './infrastructure/persistence/tenant.repository.impl';
import {
  CreateTenantUseCase,
  GetTenantsUseCase,
  GetTenantByIdUseCase,
  UpdateTenantUseCase,
  DeleteTenantUseCase,
} from './application/use-cases/tenant.use-cases';
import { TenantController } from './interfaces/controllers/tenant.controller';

@Module({
  imports: [TypeOrmModule.forFeature([TenantEntity])],
  controllers: [TenantController],
  providers: [
    {
      provide: 'TenantRepository',
      useClass: TenantRepositoryImpl,
    },
    CreateTenantUseCase,
    GetTenantsUseCase,
    GetTenantByIdUseCase,
    UpdateTenantUseCase,
    DeleteTenantUseCase,
  ],
  exports: ['TenantRepository'],
})
export class TenantsModule {}
