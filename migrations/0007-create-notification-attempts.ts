import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNotificationAttempts1700000000007 implements MigrationInterface {
  name = 'CreateNotificationAttempts1700000000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "notification_attempts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "delivery_id" uuid NOT NULL,
        "attempt_number" int NOT NULL,
        "result" varchar(20) NOT NULL,
        "provider_message_id" varchar(255),
        "error_type" varchar(100),
        "error_message" text,
        "attempted_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_attempts_delivery" FOREIGN KEY ("delivery_id") REFERENCES "notification_deliveries"("id") ON DELETE CASCADE,
        CONSTRAINT "uq_attempt_delivery_number" UNIQUE ("delivery_id", "attempt_number")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_attempts_delivery" ON "notification_attempts" ("delivery_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "notification_attempts"`);
  }
}
