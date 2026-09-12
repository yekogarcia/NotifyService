import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNotificationDeliveries1700000000006 implements MigrationInterface {
  name = 'CreateNotificationDeliveries1700000000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "notification_deliveries" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "notification_id" uuid NOT NULL,
        "recipient_id" uuid NOT NULL,
        "channel" varchar(20) NOT NULL,
        "provider_id" uuid,
        "status" varchar(20) NOT NULL DEFAULT 'CREATED',
        "attempt_count" int NOT NULL DEFAULT 0,
        "max_attempts" int NOT NULL DEFAULT 3,
        "provider_message_id" varchar(255),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_deliveries_notification" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_deliveries_recipient" FOREIGN KEY ("recipient_id") REFERENCES "notification_recipients"("id") ON DELETE CASCADE
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_delivery_notification" ON "notification_deliveries" ("notification_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_delivery_status" ON "notification_deliveries" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_delivery_recipient_channel" ON "notification_deliveries" ("recipient_id", "channel")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "notification_deliveries"`);
  }
}
