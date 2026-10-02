import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Backfill: las notificaciones quedaban en QUEUED para siempre porque nada
 * recalculaba su estado desde los deliveries. Misma regla que
 * RefreshNotificationStatusUseCase (solo filas con deliveries).
 */
export class BackfillNotificationStatus1700000000028
  implements MigrationInterface
{
  name = 'BackfillNotificationStatus1700000000028';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE notifications n SET status = agg.next, updated_at = now()
       FROM (
         SELECT d.notification_id AS nid,
           CASE
             WHEN COUNT(*) FILTER (WHERE d.status = 'FAILED') = COUNT(*) THEN 'FAILED'
             WHEN COUNT(*) FILTER (WHERE d.status IN ('SENT','DELIVERED')) = COUNT(*)
               THEN CASE WHEN COUNT(*) FILTER (WHERE d.status = 'SENT') > 0 THEN 'SENT' ELSE 'DELIVERED' END
             WHEN COUNT(*) FILTER (WHERE d.status IN ('SENT','DELIVERED','FAILED')) > 0 THEN 'PROCESSING'
             ELSE NULL
           END AS next
         FROM notification_deliveries d
         GROUP BY d.notification_id
       ) agg
       WHERE agg.nid = n.id AND agg.next IS NOT NULL AND n.status IS DISTINCT FROM agg.next`,
    );
  }

  public async down(): Promise<void> {
    // Backfill de datos: sin reversa (los estados ya avanzan por el worker).
  }
}
