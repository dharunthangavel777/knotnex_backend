import { query } from '../config/database';
import { config } from '../config';
import { NotificationService } from './notification.service';
import { logger } from '../config/logger';

export interface ContentRevision {
  id: string;
  entity_type: 'event' | 'job' | 'scheme';
  entity_id: string;
  org_id: string;
  version_number: number;
  changes: Record<string, any>;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  rejection_reason?: string;
  submitted_by?: string;
  reviewed_by?: string;
  created_at: string;
  reviewed_at?: string;
}

export const inMemoryRevisions: any[] = [];

export class ContentRevisionService {
  /**
   * Submit a new revision for an existing approved entity
   */
  static async createRevision(
    entityType: 'event' | 'job' | 'scheme',
    entityId: string,
    orgId: string,
    changes: Record<string, any>,
    submittedBy?: string
  ) {
    try {
      // 1. Get current version number
      let tableName = 'events';
      if (entityType === 'job') tableName = 'jobs';
      else if (entityType === 'scheme') tableName = 'schemes';

      const currentRes = await query(`SELECT current_version, title FROM ${tableName} WHERE id = $1`, [entityId]);
      const currentVersion = currentRes.rows[0]?.current_version || 1;
      const nextVersion = currentVersion + 1;

      // 2. Insert into content_revisions
      const revRes = await query(
        `INSERT INTO content_revisions (
          entity_type, entity_id, org_id, version_number, changes, status, submitted_by
        ) VALUES ($1, $2, $3, $4, $5, 'PENDING_APPROVAL', $6)
        RETURNING *`,
        [entityType, entityId, orgId, nextVersion, JSON.stringify(changes), submittedBy || null]
      );

      // 3. Mark has_pending_revision = true on the entity
      await query(`UPDATE ${tableName} SET has_pending_revision = true, updated_at = NOW() WHERE id = $1`, [entityId]);

      const rev = revRes.rows[0];
      inMemoryRevisions.unshift(rev);
      return rev;
    } catch (err: any) {
      if (config.env === 'development' || !config.isProduction) {
        const rev = {
          id: `rev-${Date.now()}`,
          entity_type: entityType,
          entity_id: entityId,
          org_id: orgId,
          version_number: 2,
          changes,
          status: 'PENDING_APPROVAL',
          submitted_by: submittedBy || null,
          created_at: new Date().toISOString(),
        };
        inMemoryRevisions.unshift(rev);
        return rev;
      }
      throw err;
    }
  }

  /**
   * List pending revisions with current live entity data for comparison
   */
  static async listPendingRevisions() {
    try {
      const revsRes = await query(`
        SELECT r.*, o.name as org_name, o.logo_url as org_logo
        FROM content_revisions r
        LEFT JOIN organizations o ON r.org_id = o.id
        WHERE r.status = 'PENDING_APPROVAL'
        ORDER BY r.created_at DESC
      `);

      const revisionsWithLive = await Promise.all(
        revsRes.rows.map(async (rev: any) => {
          let tableName = 'events';
          if (rev.entity_type === 'job') tableName = 'jobs';
          else if (rev.entity_type === 'scheme') tableName = 'schemes';

          const liveRes = await query(`SELECT * FROM ${tableName} WHERE id = $1`, [rev.entity_id]);
          return {
            ...rev,
            changes: typeof rev.changes === 'string' ? JSON.parse(rev.changes) : rev.changes,
            live_entity: liveRes.rows[0] || null,
          };
        })
      );

      return revisionsWithLive;
    } catch (err: any) {
      if (config.env === 'development' || !config.isProduction) {
        return inMemoryRevisions.filter((r) => r.status === 'PENDING_APPROVAL');
      }
      throw err;
    }
  }

  /**
   * Approve a revision and apply changes to the live entity
   */
  static async approveRevision(revisionId: string, reviewedBy?: string) {
    try {
      const revRes = await query(`SELECT * FROM content_revisions WHERE id = $1`, [revisionId]);
      if (revRes.rows.length === 0) throw new Error('Revision not found');

      const rev = revRes.rows[0];
      const changes = typeof rev.changes === 'string' ? JSON.parse(rev.changes) : rev.changes;
      const entityType = rev.entity_type;
      const entityId = rev.entity_id;

      let tableName = 'events';
      if (entityType === 'job') tableName = 'jobs';
      else if (entityType === 'scheme') tableName = 'schemes';

      // Build update query for live entity
      const fields: string[] = [];
      const values: any[] = [entityId];
      let idx = 2;

      for (const [key, value] of Object.entries(changes)) {
        // Exclude system fields
        if (['id', 'org_id', 'created_by', 'created_at', 'current_version', 'has_pending_revision'].includes(key)) {
          continue;
        }
        fields.push(`${key} = $${idx++}`);
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          values.push(JSON.stringify(value));
        } else {
          values.push(value);
        }
      }

      fields.push(`current_version = current_version + 1`);
      fields.push(`has_pending_revision = false`);
      fields.push(`rejection_reason = NULL`);
      fields.push(`updated_at = NOW()`);

      if (fields.length > 0) {
        await query(`UPDATE ${tableName} SET ${fields.join(', ')} WHERE id = $1`, values);
      }

      // Mark revision as APPROVED
      const updatedRevRes = await query(
        `UPDATE content_revisions
         SET status = 'APPROVED', reviewed_by = $1, reviewed_at = NOW()
         WHERE id = $2 RETURNING *`,
        [reviewedBy || null, revisionId]
      );

      // Notify organization
      if (rev.submitted_by) {
        await NotificationService.createNotification(
          rev.submitted_by,
          reviewedBy || '00000000-0000-0000-0000-000000000001',
          `${entityType}_revision_approved`,
          'Updates Approved & Published!',
          `Your edited changes for ${entityType} have been approved and are now live across KnotNex.`,
          { entityId, entityType, revisionId }
        ).catch(() => {});
      }

      return updatedRevRes.rows[0];
    } catch (err: any) {
      if (config.env === 'development' || !config.isProduction) {
        const rev = inMemoryRevisions.find((r) => String(r.id) === String(revisionId));
        if (rev) {
          rev.status = 'APPROVED';
          rev.reviewed_at = new Date().toISOString();
          return rev;
        }
      }
      throw err;
    }
  }

  /**
   * Reject a revision with reason while preserving the live entity
   */
  static async rejectRevision(revisionId: string, reviewedBy?: string, reason?: string) {
    try {
      const revRes = await query(`SELECT * FROM content_revisions WHERE id = $1`, [revisionId]);
      if (revRes.rows.length === 0) throw new Error('Revision not found');

      const rev = revRes.rows[0];
      const entityType = rev.entity_type;
      const entityId = rev.entity_id;

      let tableName = 'events';
      if (entityType === 'job') tableName = 'jobs';
      else if (entityType === 'scheme') tableName = 'schemes';

      // Clear has_pending_revision on live entity
      await query(`UPDATE ${tableName} SET has_pending_revision = false, updated_at = NOW() WHERE id = $1`, [entityId]);

      // Mark revision as REJECTED
      const updatedRevRes = await query(
        `UPDATE content_revisions
         SET status = 'REJECTED', rejection_reason = $1, reviewed_by = $2, reviewed_at = NOW()
         WHERE id = $3 RETURNING *`,
        [reason || 'Changes do not meet publication standards', reviewedBy || null, revisionId]
      );

      // Notify organization
      if (rev.submitted_by) {
        await NotificationService.createNotification(
          rev.submitted_by,
          reviewedBy || '00000000-0000-0000-0000-000000000001',
          `${entityType}_revision_rejected`,
          'Update Revisions Requested',
          `Your proposed changes for ${entityType} were not approved: ${reason || 'Revisions required'}. The current live version remains unchanged.`,
          { entityId, entityType, revisionId, reason }
        ).catch(() => {});
      }

      return updatedRevRes.rows[0];
    } catch (err: any) {
      if (config.env === 'development' || !config.isProduction) {
        const rev = inMemoryRevisions.find((r) => String(r.id) === String(revisionId));
        if (rev) {
          rev.status = 'REJECTED';
          rev.rejection_reason = reason;
          rev.reviewed_at = new Date().toISOString();
          return rev;
        }
      }
      throw err;
    }
  }
}
