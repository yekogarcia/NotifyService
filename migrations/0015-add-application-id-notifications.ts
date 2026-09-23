import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddApplicationIdToNotifications1700000000015 implements MigrationInterface {
  name = 'AddApplicationIdToNotifications1700000000015';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD COLUMN "application_id" uuid`,
    );
    await queryRunner.query(
      `UPDATE "notifications" SET "application_id" = (SELECT id FROM "applications" LIMIT 1) WHERE "application_id" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ALTER COLUMN "application_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD CONSTRAINT "fk_notifications_application" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_notifications_application_id" ON "notifications" ("application_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "UQ_notifications_tenant_idempotency"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_notifications_tenant_app_idempotency" ON "notifications" ("tenant_id", "application_id", "idempotency_key")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_notifications_tenant_app_idempotency"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_notifications_application_id"`);
    await queryRunner.query(`ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "fk_notifications_application"`);
    await queryRunner.query(`ALTER TABLE "notifications" DROP COLUMN "application_id"`);
  }
}
