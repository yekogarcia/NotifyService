import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ChannelType } from '../../notifications/domain/enums';

export interface DashboardFilters {
  tenantId: string;
  from?: string;
  to?: string;
  applicationId?: string;
  channel?: ChannelType;
}

interface WhereClause {
  sql: string;
  params: unknown[];
}

/**
 * Agregaciones del dashboard leídas de PostgreSQL (persistentes y por tenant).
 * Todas las métricas de deliveries/attempts se anclan a `notifications`
 * (tenant_id + created_at indexados) para no mezclar tenants.
 */
@Injectable()
export class DashboardService {
  constructor(private readonly dataSource: DataSource) {}

  private baseWhere(
    f: DashboardFilters,
    alias = 'n',
    startIndex = 1,
  ): WhereClause {
    const conds: string[] = [`${alias}.tenant_id = $${startIndex}`];
    const params: unknown[] = [f.tenantId];
    let i = startIndex + 1;
    // Rango por defecto: últimos 30 días.
    const from = f.from ?? new Date(Date.now() - 30 * 864e5).toISOString();
    conds.push(`${alias}.created_at >= $${i++}`);
    params.push(from);
    if (f.to) {
      conds.push(`${alias}.created_at <= $${i++}`);
      params.push(f.to);
    }
    if (f.applicationId) {
      conds.push(`${alias}.application_id = $${i++}`);
      params.push(f.applicationId);
    }
    return { sql: conds.join(' AND '), params };
  }

  async summary(f: DashboardFilters) {
    const w = this.baseWhere(f);
    const channelFilter = f.channel
      ? `AND d.channel = $${w.params.length + 1}`
      : '';
    const params = f.channel ? [...w.params, f.channel] : w.params;
    const rows = await this.dataSource.query(
      `SELECT
         COUNT(DISTINCT n.id)::int AS notifications,
         COUNT(d.id)::int AS deliveries,
         COUNT(d.id) FILTER (WHERE d.status IN ('SENT','DELIVERED'))::int AS sent,
         COUNT(d.id) FILTER (WHERE d.status = 'FAILED')::int AS failed,
         COUNT(d.id) FILTER (WHERE d.status IN ('CREATED','QUEUED','PROCESSING','RETRYING'))::int AS pending,
         COUNT(d.id) FILTER (WHERE d.attempt_count > 1)::int AS retried,
         COALESCE(AVG(d.attempt_count), 0)::float AS "avgAttempts",
         (SELECT COUNT(*)::int FROM applications a WHERE a.tenant_id = $1 AND a.is_active = true) AS "activeApps",
         (SELECT COUNT(*)::int FROM notification_providers p WHERE p.tenant_id = $1 AND p.status = 'ACTIVE') AS "activeProviders"
       FROM notifications n
       LEFT JOIN notification_deliveries d ON d.notification_id = n.id ${channelFilter}
       WHERE ${w.sql}`,
      params,
    );
    const r = rows[0] ?? {};
    const deliveries = Number(r.deliveries ?? 0);
    const sent = Number(r.sent ?? 0);
    return {
      notifications: Number(r.notifications ?? 0),
      deliveries,
      sent,
      failed: Number(r.failed ?? 0),
      pending: Number(r.pending ?? 0),
      retried: Number(r.retried ?? 0),
      avgAttempts: Number(r.avgAttempts ?? 0),
      successRate: deliveries > 0 ? sent / deliveries : 0,
      activeApps: Number(r.activeApps ?? 0),
      activeProviders: Number(r.activeProviders ?? 0),
    };
  }

  async volume(f: DashboardFilters, granularity: 'day' | 'hour' = 'day') {
    const w = this.baseWhere(f);
    const rows = await this.dataSource.query(
      `SELECT date_trunc('${granularity}', n.created_at) AS bucket,
         COUNT(DISTINCT n.id)::int AS notifications,
         COUNT(d.id)::int AS deliveries,
         COUNT(d.id) FILTER (WHERE d.status IN ('SENT','DELIVERED'))::int AS sent,
         COUNT(d.id) FILTER (WHERE d.status = 'FAILED')::int AS failed
       FROM notifications n
       LEFT JOIN notification_deliveries d ON d.notification_id = n.id
       WHERE ${w.sql}
       GROUP BY 1 ORDER BY 1`,
      w.params,
    );
    return rows.map((r: Record<string, unknown>) => ({
      bucket: r.bucket,
      notifications: Number(r.notifications ?? 0),
      deliveries: Number(r.deliveries ?? 0),
      sent: Number(r.sent ?? 0),
      failed: Number(r.failed ?? 0),
    }));
  }

  async byChannel(f: DashboardFilters) {
    const w = this.baseWhere(f);
    const rows = await this.dataSource.query(
      `SELECT d.channel AS channel,
         COUNT(d.id)::int AS deliveries,
         COUNT(d.id) FILTER (WHERE d.status IN ('SENT','DELIVERED'))::int AS sent,
         COUNT(d.id) FILTER (WHERE d.status = 'FAILED')::int AS failed,
         COUNT(d.id) FILTER (WHERE d.status IN ('CREATED','QUEUED','PROCESSING','RETRYING'))::int AS pending
       FROM notification_deliveries d
       JOIN notifications n ON n.id = d.notification_id
       WHERE ${w.sql}
       GROUP BY d.channel ORDER BY deliveries DESC`,
      w.params,
    );
    return rows.map((r: Record<string, unknown>) => {
      const deliveries = Number(r.deliveries ?? 0);
      const sent = Number(r.sent ?? 0);
      return {
        channel: r.channel,
        deliveries,
        sent,
        failed: Number(r.failed ?? 0),
        pending: Number(r.pending ?? 0),
        successRate: deliveries > 0 ? sent / deliveries : 0,
      };
    });
  }

  async byApplication(f: DashboardFilters, limit = 10) {
    const w = this.baseWhere(f);
    const rows = await this.dataSource.query(
      `SELECT a.id AS "applicationId", a.name AS "appName",
         COUNT(DISTINCT n.id)::int AS notifications,
         COUNT(d.id)::int AS deliveries,
         COUNT(d.id) FILTER (WHERE d.status IN ('SENT','DELIVERED'))::int AS sent,
         COUNT(d.id) FILTER (WHERE d.status = 'FAILED')::int AS failed
       FROM notifications n
       JOIN applications a ON a.id = n.application_id
       LEFT JOIN notification_deliveries d ON d.notification_id = n.id
       WHERE ${w.sql}
       GROUP BY a.id, a.name
       ORDER BY notifications DESC
       LIMIT $${w.params.length + 1}`,
      [...w.params, limit],
    );
    return rows.map((r: Record<string, unknown>) => {
      const deliveries = Number(r.deliveries ?? 0);
      const sent = Number(r.sent ?? 0);
      return {
        applicationId: r.applicationId,
        appName: r.appName,
        notifications: Number(r.notifications ?? 0),
        deliveries,
        sent,
        failed: Number(r.failed ?? 0),
        successRate: deliveries > 0 ? sent / deliveries : 0,
      };
    });
  }

  async byProvider(f: DashboardFilters) {
    const w = this.baseWhere(f);
    const params = [...w.params];
    let channelFilter = '';
    if (f.channel) {
      channelFilter = `AND d.channel = $${params.length + 1}`;
      params.push(f.channel);
    }
    const subWhere = w.sql.replaceAll('n.', 'n2.');
    const rows = await this.dataSource.query(
      `SELECT d.provider_id AS "providerId",
         p.name AS "providerName", p.provider_type AS "providerType",
         p.status AS "providerStatus",
         COUNT(d.id)::int AS deliveries,
         COUNT(d.id) FILTER (WHERE d.status IN ('SENT','DELIVERED'))::int AS sent,
         COUNT(d.id) FILTER (WHERE d.status = 'FAILED')::int AS failed,
         COALESCE(AVG(d.attempt_count), 0)::float AS "avgAttempts",
         MAX(d.updated_at) AS "lastActivityAt",
         (SELECT a.error_type FROM notification_attempts a
            JOIN notification_deliveries d2 ON d2.id = a.delivery_id
            JOIN notifications n2 ON n2.id = d2.notification_id
           WHERE ${subWhere}
             AND d2.provider_id IS NOT DISTINCT FROM d.provider_id
             AND a.error_type IS NOT NULL
           ORDER BY a.attempted_at DESC LIMIT 1) AS "lastErrorType"
       FROM notification_deliveries d
       JOIN notifications n ON n.id = d.notification_id
       LEFT JOIN notification_providers p ON p.id = d.provider_id
       WHERE ${w.sql} ${channelFilter}
       GROUP BY d.provider_id, p.name, p.provider_type, p.status
       ORDER BY deliveries DESC`,
      params,
    );
    return rows.map((r: Record<string, unknown>) => {
      const deliveries = Number(r.deliveries ?? 0);
      const sent = Number(r.sent ?? 0);
      return {
        providerId: r.providerId,
        providerName: r.providerName ?? '(fallback .env)',
        providerType: r.providerType,
        providerStatus: r.providerStatus,
        deliveries,
        sent,
        failed: Number(r.failed ?? 0),
        successRate: deliveries > 0 ? sent / deliveries : 0,
        avgAttempts: Number(r.avgAttempts ?? 0),
        lastErrorType: r.lastErrorType,
        lastActivityAt: r.lastActivityAt,
      };
    });
  }

  async failures(f: DashboardFilters, limit = 10) {
    const w = this.baseWhere(f);
    const params = [...w.params];
    let channelFilter = '';
    if (f.channel) {
      channelFilter = `AND d.channel = $${params.length + 1}`;
      params.push(f.channel);
    }
    const [byError, split, recent] = await Promise.all([
      this.dataSource.query(
        `SELECT a.error_type AS "errorType", COUNT(*)::int AS count
         FROM notification_attempts a
         JOIN notification_deliveries d ON d.id = a.delivery_id
         JOIN notifications n ON n.id = d.notification_id
         WHERE ${w.sql} ${channelFilter} AND a.error_type IS NOT NULL
         GROUP BY a.error_type ORDER BY count DESC LIMIT 10`,
        params,
      ),
      this.dataSource.query(
        `SELECT a.result AS result, COUNT(*)::int AS count
         FROM notification_attempts a
         JOIN notification_deliveries d ON d.id = a.delivery_id
         JOIN notifications n ON n.id = d.notification_id
         WHERE ${w.sql} ${channelFilter}
         GROUP BY a.result`,
        params,
      ),
      this.dataSource.query(
        `SELECT d.id AS "deliveryId", d.channel AS channel,
           d.status AS status, d.attempt_count AS "attemptCount",
           d.provider_id AS "providerId", p.name AS "providerName",
           d.notification_id AS "notificationId",
           (SELECT a.error_message FROM notification_attempts a
             WHERE a.delivery_id = d.id AND a.error_message IS NOT NULL
             ORDER BY a.attempted_at DESC LIMIT 1) AS "lastError",
           d.updated_at AS "updatedAt"
         FROM notification_deliveries d
         JOIN notifications n ON n.id = d.notification_id
         LEFT JOIN notification_providers p ON p.id = d.provider_id
         WHERE ${w.sql} ${channelFilter} AND d.status = 'FAILED'
         ORDER BY d.updated_at DESC LIMIT $${params.length + 1}`,
        [...params, limit],
      ),
    ]);
    return {
      byErrorType: byError.map((r: Record<string, unknown>) => ({
        errorType: r.errorType,
        count: Number(r.count ?? 0),
      })),
      resultSplit: split.map((r: Record<string, unknown>) => ({
        result: r.result,
        count: Number(r.count ?? 0),
      })),
      recent: recent.map((r: Record<string, unknown>) => ({
        deliveryId: r.deliveryId,
        notificationId: r.notificationId,
        channel: r.channel,
        status: r.status,
        attemptCount: Number(r.attemptCount ?? 0),
        providerId: r.providerId,
        providerName: r.providerName,
        lastError: r.lastError,
        updatedAt: r.updatedAt,
      })),
    };
  }

  async latency(f: DashboardFilters) {
    const w = this.baseWhere(f);
    const rows = await this.dataSource.query(
      `SELECT d.channel AS channel,
         COUNT(d.id)::int AS deliveries,
         COALESCE(AVG(EXTRACT(EPOCH FROM (d.updated_at - d.created_at))), 0)::float AS "avgSeconds",
         COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (d.updated_at - d.created_at))), 0)::float AS "p50Seconds",
         COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (d.updated_at - d.created_at))), 0)::float AS "p95Seconds"
       FROM notification_deliveries d
       JOIN notifications n ON n.id = d.notification_id
       WHERE ${w.sql} AND d.status IN ('SENT','DELIVERED')
       GROUP BY d.channel ORDER BY d.channel`,
      w.params,
    );
    return rows.map((r: Record<string, unknown>) => ({
      channel: r.channel,
      deliveries: Number(r.deliveries ?? 0),
      avgSeconds: Number(r.avgSeconds ?? 0),
      p50Seconds: Number(r.p50Seconds ?? 0),
      p95Seconds: Number(r.p95Seconds ?? 0),
    }));
  }

  async activity(f: DashboardFilters, limit = 20) {
    const conds = [`e.tenant_id = $1`];
    const params: unknown[] = [f.tenantId];
    let i = 2;
    if (f.applicationId) {
      conds.push(`e.application_id = $${i++}`);
      params.push(f.applicationId);
    }
    const rows = await this.dataSource.query(
      `SELECT e.id AS id, e.event_type AS "eventType",
         e.notification_id AS "notificationId", e.delivery_id AS "deliveryId",
         e.application_id AS "applicationId", a.name AS "appName",
         e.created_at AS "createdAt"
       FROM notification_events e
       LEFT JOIN applications a ON a.id = e.application_id
       WHERE ${conds.join(' AND ')}
       ORDER BY e.created_at DESC LIMIT $${i}`,
      [...params, limit],
    );
    return rows;
  }
}
