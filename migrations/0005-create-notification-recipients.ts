import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNotificationRecipients1700000000005 implements MigrationInterface {
  name = 'CreateNotificationRecipients1700000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "notification_recipients" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "notification_id" uuid NOT NULL,
        "recipient_type" varchar(20) NOT NULL,
        "user_id" varchar(255),
        "email" varchar(255),
        "phone" varchar(20),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_recipients_notification" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE,
        CONSTRAINT "chk_recipient_has_contact" CHECK (
          "user_id" IS NOT NULL OR "email" IS NOT NULL OR "phone" IS NOT NULL
        )
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_recipients_notification" ON "notification_recipients" ("notification_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "notification_recipients"`);
  }
}
