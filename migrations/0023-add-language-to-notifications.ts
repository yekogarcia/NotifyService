import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLanguageToNotifications1700000000023
  implements MigrationInterface
{
  name = 'AddLanguageToNotifications1700000000023';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD COLUMN "language" varchar(10)`,
    );
    await queryRunner.query(
      `UPDATE "notifications" SET "language" = 'es' WHERE "language" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ALTER COLUMN "language" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ALTER COLUMN "language" SET DEFAULT 'es'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notifications" DROP COLUMN "language"`,
    );
  }
}
