import { query } from '../../src/config/database';
import { logger } from '../../src/config/logger';

export async function cleanupTestUsers(pattern: string = '%'): Promise<number> {
  try {
    const res = await query(
      `DELETE FROM users 
       WHERE email LIKE '%@knotnex.test' 
          OR email LIKE 'test_%' 
          OR email LIKE 'loadtest_%' 
          OR email LIKE 'reg_%' 
          OR email LIKE 'login_%'
          OR email LIKE 'token_%'
          OR email LIKE 'authz_%'
          OR email LIKE 'sec_%'
          OR email LIKE 'lifecycle_%'
       RETURNING id`
    );
    const count = res.rowCount || 0;
    logger.info(`[Cleanup] Deleted ${count} test user records from database`);
    return count;
  } catch (err: any) {
    logger.error(`[Cleanup] Error cleaning up test users: ${err.message}`);
    return 0;
  }
}
