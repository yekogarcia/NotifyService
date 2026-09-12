import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNotificationPreferences1700000000010 implements MigrationInterface {
  name = 'CreateNotificationPreferences1700000000010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "notification_preferences" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL,
        "user_id" varchar(255) NOT NULL,
        "channel" varchar(20) NOT NULL,
        "enabled" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_prefs_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "uq_prefs_tenant_user_channel" UNIQUE ("tenant_id", "user_id", "channel")
      )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "notification_preferences"`);
  }
}
