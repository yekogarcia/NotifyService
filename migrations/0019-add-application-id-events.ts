import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddApplicationIdToEvents1700000000019 implements MigrationInterface {
  name = 'AddApplicationIdToEvents1700000000019';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notification_events" ADD COLUMN "application_id" uuid`,
    );
    await queryRunner.query(
      `UPDATE "notification_events" SET "application_id" = (SELECT id FROM "applications" LIMIT 1) WHERE "application_id" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "notification_events" ALTER COLUMN "application_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "notification_events" ADD CONSTRAINT "fk_events_application" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_events_application_id" ON "notification_events" ("application_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_events_tenant_app_created" ON "notification_events" ("tenant_id", "application_id", "created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_events_tenant_app_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_events_application_id"`);
    await queryRunner.query(`ALTER TABLE "notification_events" DROP CONSTRAINT IF EXISTS "fk_events_application"`);
    await queryRunner.query(`ALTER TABLE "notification_events" DROP COLUMN "application_id"`);
  }
}
