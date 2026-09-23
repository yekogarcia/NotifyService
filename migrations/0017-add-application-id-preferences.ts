import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddApplicationIdToPreferences1700000000017 implements MigrationInterface {
  name = 'AddApplicationIdToPreferences1700000000017';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notification_preferences" ADD COLUMN "application_id" uuid`,
    );
    await queryRunner.query(
      `UPDATE "notification_preferences" SET "application_id" = (SELECT id FROM "applications" LIMIT 1) WHERE "application_id" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "notification_preferences" ALTER COLUMN "application_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "notification_preferences" ADD CONSTRAINT "fk_preferences_application" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_preferences_application_id" ON "notification_preferences" ("application_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "notification_preferences" DROP CONSTRAINT IF EXISTS "uq_preferences_tenant_user_channel"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notification_preferences" ADD CONSTRAINT "uq_preferences_tenant_app_user_channel" UNIQUE ("tenant_id", "application_id", "user_id", "channel")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "notification_preferences" DROP CONSTRAINT IF EXISTS "uq_preferences_tenant_app_user_channel"`);
    await queryRunner.query(`ALTER TABLE "notification_preferences" ADD CONSTRAINT "uq_preferences_tenant_user_channel" UNIQUE ("tenant_id", "user_id", "channel")`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_preferences_application_id"`);
    await queryRunner.query(`ALTER TABLE "notification_preferences" DROP CONSTRAINT IF EXISTS "fk_preferences_application"`);
    await queryRunner.query(`ALTER TABLE "notification_preferences" DROP COLUMN "application_id"`);
  }
}
