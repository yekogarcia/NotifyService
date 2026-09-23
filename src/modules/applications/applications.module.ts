import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApplicationEntity } from './domain/entities/application.entity';
import { ApplicationRepositoryImpl } from './infrastructure/persistence/application.repository.impl';
import {
  GenerateCredentialsUseCase,
  CreateApplicationUseCase,
  GetApplicationsUseCase,
  GetApplicationByIdUseCase,
  UpdateApplicationUseCase,
  DeleteApplicationUseCase,
  RotateSecretUseCase,
} from './application/use-cases/application.use-cases';
import { ApplicationController } from './interfaces/controllers/application.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ApplicationEntity])],
  controllers: [ApplicationController],
  providers: [
    {
      provide: 'ApplicationRepository',
      useClass: ApplicationRepositoryImpl,
    },
    GenerateCredentialsUseCase,
    CreateApplicationUseCase,
    GetApplicationsUseCase,
    GetApplicationByIdUseCase,
    UpdateApplicationUseCase,
    DeleteApplicationUseCase,
    RotateSecretUseCase,
  ],
  exports: ['ApplicationRepository'],
})
export class ApplicationsModule {}
