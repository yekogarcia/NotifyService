import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddApplicationIdToTemplates1700000000016 implements MigrationInterface {
  name = 'AddApplicationIdToTemplates1700000000016';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notification_templates" ADD COLUMN "application_id" uuid`,
    );
    await queryRunner.query(
      `UPDATE "notification_templates" SET "application_id" = (SELECT id FROM "applications" LIMIT 1) WHERE "application_id" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "notification_templates" ALTER COLUMN "application_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "notification_templates" ADD CONSTRAINT "fk_templates_application" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_templates_application_id" ON "notification_templates" ("application_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "notification_templates" DROP CONSTRAINT IF EXISTS "uq_template_tenant_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notification_templates" ADD CONSTRAINT "uq_template_tenant_app_code" UNIQUE ("tenant_id", "application_id", "code")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "notification_templates" DROP CONSTRAINT IF EXISTS "uq_template_tenant_app_code"`);
    await queryRunner.query(`ALTER TABLE "notification_templates" ADD CONSTRAINT "uq_template_tenant_code" UNIQUE ("tenant_id", "code")`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_templates_application_id"`);
    await queryRunner.query(`ALTER TABLE "notification_templates" DROP CONSTRAINT IF EXISTS "fk_templates_application"`);
    await queryRunner.query(`ALTER TABLE "notification_templates" DROP COLUMN "application_id"`);
  }
}
