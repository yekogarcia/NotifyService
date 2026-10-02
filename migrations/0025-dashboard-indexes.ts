import { MigrationInterface, QueryRunner } from 'typeorm';

export class DashboardIndexes1700000000025 implements MigrationInterface {
  name = 'DashboardIndexes1700000000025';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Filtros y agregaciones del dashboard sobre deliveries/attempts.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_deliveries_created" ON "notification_deliveries" ("created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_deliveries_channel" ON "notification_deliveries" ("channel")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_deliveries_provider" ON "notification_deliveries" ("provider_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_deliveries_notification_status" ON "notification_deliveries" ("notification_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_attempts_attempted" ON "notification_attempts" ("attempted_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_attempts_attempted"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_deliveries_notification_status"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_deliveries_provider"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_deliveries_channel"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_deliveries_created"`,
    );
  }
}
