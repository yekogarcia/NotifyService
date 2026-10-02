import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStatusToTemplates1700000000026 implements MigrationInterface {
  name = 'AddStatusToTemplates1700000000026';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notification_templates" ADD COLUMN "status" varchar(20) NOT NULL DEFAULT 'ACTIVE'`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_templates_tenant_status" ON "notification_templates" ("tenant_id", "status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_templates_tenant_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notification_templates" DROP COLUMN "status"`,
    );
  }
}
