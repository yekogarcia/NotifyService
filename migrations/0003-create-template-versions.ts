import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTemplateVersions1700000000003 implements MigrationInterface {
  name = 'CreateTemplateVersions1700000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "notification_template_versions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "template_id" uuid NOT NULL,
        "version" int NOT NULL,
        "language" varchar(10) NOT NULL,
        "channel" varchar(20) NOT NULL,
        "subject" text,
        "body" text NOT NULL,
        "is_active" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "activated_at" timestamptz,
        CONSTRAINT "fk_versions_template" FOREIGN KEY ("template_id") REFERENCES "notification_templates"("id") ON DELETE CASCADE,
        CONSTRAINT "uq_version_template_ver_lang_ch" UNIQUE ("template_id", "version", "language", "channel")
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_active_version_per_lang_ch"
       ON "notification_template_versions" ("template_id", "language", "channel")
       WHERE "is_active" = true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_active_version_per_lang_ch"`);
    await queryRunner.query(`DROP TABLE "notification_template_versions"`);
  }
}
