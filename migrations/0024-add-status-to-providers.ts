import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStatusToProviders1700000000024 implements MigrationInterface {
  name = 'AddStatusToProviders1700000000024';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notification_providers" ADD COLUMN "status" varchar(20) NOT NULL DEFAULT 'ACTIVE'`,
    );
    // Sincroniza filas existentes: is_active=false -> INACTIVE, resto ACTIVE.
    await queryRunner.query(
      `UPDATE "notification_providers" SET "status" = 'INACTIVE' WHERE "is_active" = false AND "status" = 'ACTIVE'`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_provider_tenant_status" ON "notification_providers" ("tenant_id", "status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_provider_tenant_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notification_providers" DROP COLUMN "status"`,
    );
  }
}
