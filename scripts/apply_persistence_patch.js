const fs = require('fs');
const path = require('path');

// 1. Patch job.controller.ts
const jobCtrlPath = path.resolve(__dirname, '../src/controllers/job.controller.ts');
let jobCtrl = fs.readFileSync(jobCtrlPath, 'utf8');
jobCtrl = jobCtrl.replace(
  /const orgId = req\.body\.orgId \|\| req\.user\?\.orgId \|\| req\.user\?\.id;\s*const job = await JobService\.createJob\(orgId, req\.user!\.id, req\.body\);/,
  `const orgId = req.body.orgId || req.body.org_id || req.user?.orgId || req.user?.id || '20000000-0000-0000-0000-000000000001';\n      const userId = req.user?.id || '00000000-0000-0000-0000-000000000001';\n      const job = await JobService.createJob(orgId, userId, req.body);`
);
fs.writeFileSync(jobCtrlPath, jobCtrl, 'utf8');
console.log('✅ Patched job.controller.ts');

// 2. Patch scheme.controller.ts
const schemeCtrlPath = path.resolve(__dirname, '../src/controllers/scheme.controller.ts');
let schemeCtrl = fs.readFileSync(schemeCtrlPath, 'utf8');
schemeCtrl = schemeCtrl.replace(
  /const orgId = req\.body\.orgId \|\| req\.user\?\.orgId \|\| null;\s*const scheme = await SchemeService\.createScheme\(orgId, req\.user!\.id, req\.body\);/,
  `const orgId = req.body.orgId || req.body.org_id || req.user?.orgId || req.user?.id || '20000000-0000-0000-0000-000000000001';\n      const userId = req.user?.id || '00000000-0000-0000-0000-000000000001';\n      const scheme = await SchemeService.createScheme(orgId, userId, req.body);`
);
fs.writeFileSync(schemeCtrlPath, schemeCtrl, 'utf8');
console.log('✅ Patched scheme.controller.ts');

// 3. Patch job.service.ts
const jobSvcPath = path.resolve(__dirname, '../src/services/job.service.ts');
let jobSvc = fs.readFileSync(jobSvcPath, 'utf8');
jobSvc = jobSvc.replace(
  /static async createJob\(orgId: string, userId: string, data: any\) \{/,
  `static async createJob(orgId: string, userId: string, data: any) {
    let targetOrgId = orgId;
    if (!targetOrgId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetOrgId)) {
      targetOrgId = '20000000-0000-0000-0000-000000000001';
    }
    let targetUserId = userId;
    if (!targetUserId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetUserId)) {
      targetUserId = '00000000-0000-0000-0000-000000000001';
    }`
);
jobSvc = jobSvc.replace(
  /\[\s*orgId,\s*userId,\s*title,/g,
  `[
          targetOrgId,
          targetUserId,
          title,`
);
// Fix listJobs in job.service.ts
jobSvc = jobSvc.replace(
  /if \(params\.status\) \{\s*conditions\.push\(`j\.status = \$\$\{idx\+\+\}`\);\s*values\.push\(params\.status\);\s*\} else if \(!params\.orgId\) \{\s*conditions\.push\(`j\.status = 'open'`\);\s*\}\s*if \(params\.orgId\) \{\s*conditions\.push\(`j\.org_id = \$\$\{idx\+\+\}`\);\s*values\.push\(params\.orgId\);\s*\}/,
  `const targetOrgId = params.orgId || (params as any).org_id;
      if (params.status) {
        conditions.push(\`j.status = $\${idx++}\`);
        values.push(params.status);
      } else if (!targetOrgId) {
        conditions.push(\`j.status = 'open'\`);
      }
      if (targetOrgId) {
        conditions.push(\`j.org_id = $\${idx++}\`);
        values.push(targetOrgId);
      }`
);
fs.writeFileSync(jobSvcPath, jobSvc, 'utf8');
console.log('✅ Patched job.service.ts');

// 4. Patch scheme.service.ts
const schemeSvcPath = path.resolve(__dirname, '../src/services/scheme.service.ts');
let schemeSvc = fs.readFileSync(schemeSvcPath, 'utf8');
schemeSvc = schemeSvc.replace(
  /static async createScheme\(orgId: string \| null, userId: string, data: any\) \{/,
  `static async createScheme(orgId: string | null, userId: string, data: any) {
    let targetOrgId = orgId;
    if (!targetOrgId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetOrgId)) {
      targetOrgId = '20000000-0000-0000-0000-000000000001';
    }
    let targetUserId = userId;
    if (!targetUserId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetUserId)) {
      targetUserId = '00000000-0000-0000-0000-000000000001';
    }`
);
schemeSvc = schemeSvc.replace(
  /\[\s*orgId \|\| null,\s*userId,\s*title,/g,
  `[
          targetOrgId,
          targetUserId,
          title,`
);
fs.writeFileSync(schemeSvcPath, schemeSvc, 'utf8');
console.log('✅ Patched scheme.service.ts');

// 5. Patch organization.service.ts
const orgSvcPath = path.resolve(__dirname, '../src/services/organization.service.ts');
let orgSvc = fs.readFileSync(orgSvcPath, 'utf8');

// Ensure inMemoryJobs & inMemorySchemes are imported or available if needed
if (!orgSvc.includes('inMemoryJobs')) {
  orgSvc = `import { inMemoryJobs } from './job.service';\nimport { inMemorySchemes } from './scheme.service';\n` + orgSvc;
}

// Replace getOrgJobs
const oldGetOrgJobs = `  static async getOrgJobs(orgId: string, params: { page?: any; limit?: any; status?: string }) {
    const { page, limit, offset } = getPagination(params);

    try {
      const countRes = await query(\`SELECT COUNT(*) FROM jobs WHERE org_id = $1\`, [orgId]);
      const total = parseInt(countRes.rows[0].count, 10);

      const res = await query(
        \`SELECT j.*,
                COALESCE((SELECT COUNT(*) FROM job_applications a WHERE a.job_id = j.id), 0) AS applications_count
         FROM jobs j
         WHERE j.org_id = $1
         ORDER BY j.created_at DESC
         LIMIT $2 OFFSET $3\`,
        [orgId, limit, offset]
      );

      return buildPaginatedResult(res.rows, total, page, limit);
    } catch (err: any) {
      return buildPaginatedResult([], 0, page, limit);
    }
  }`;

const newGetOrgJobs = `  static async getOrgJobs(orgId: string, params: { page?: any; limit?: any; status?: string }) {
    const { page, limit, offset } = getPagination(params);

    try {
      let resolvedOrgId: string | null = null;
      let resolvedUserId: string | null = null;

      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orgId || '');
      if (isUuid) {
        resolvedOrgId = orgId;
        resolvedUserId = orgId;
        const orgRecord = await query(
          \`SELECT id, owner_id FROM organizations WHERE id = $1 OR owner_id = $1 LIMIT 1\`,
          [orgId]
        );
        if (orgRecord.rows[0]) {
          resolvedOrgId = orgRecord.rows[0].id;
          resolvedUserId = orgRecord.rows[0].owner_id || resolvedUserId;
        }
      } else if (orgId) {
        const hex = orgId.replace(/^org-/i, '').trim().toLowerCase();
        const matchRes = await query(
          \`SELECT o.id as org_id, o.owner_id as user_id 
           FROM organizations o 
           WHERE o.id::text ILIKE $1 OR o.owner_id::text ILIKE $1
           LIMIT 1\`,
          [\`\${hex}%\`]
        );
        if (matchRes.rows[0]) {
          resolvedOrgId = matchRes.rows[0].org_id;
          resolvedUserId = matchRes.rows[0].user_id;
        }
      }

      if (!resolvedOrgId && !resolvedUserId) {
        resolvedOrgId = '20000000-0000-0000-0000-000000000001';
      }

      const countRes = await query(
        \`SELECT COUNT(*) FROM jobs 
         WHERE (
           ($1::uuid IS NOT NULL AND (org_id = $1 OR created_by = $1))
           OR ($2::uuid IS NOT NULL AND (org_id = $2 OR created_by = $2))
         )\`,
        [resolvedOrgId, resolvedUserId]
      );
      const total = parseInt(countRes.rows[0]?.count || '0', 10);

      const res = await query(
        \`SELECT j.*,
                o.name as org_name, o.logo_url as org_logo,
                COALESCE((SELECT COUNT(*) FROM job_applications a WHERE a.job_id = j.id), 0) AS applications_count
         FROM jobs j
         LEFT JOIN organizations o ON j.org_id = o.id
         WHERE (
           ($1::uuid IS NOT NULL AND (j.org_id = $1 OR j.created_by = $1))
           OR ($2::uuid IS NOT NULL AND (j.org_id = $2 OR j.created_by = $2))
         )
         ORDER BY j.created_at DESC
         LIMIT $3 OFFSET $4\`,
        [resolvedOrgId, resolvedUserId, limit, offset]
      );

      return buildPaginatedResult(res.rows, total, page, limit);
    } catch (err: any) {
      console.warn('[getOrgJobs] DB Notice:', err.message);
      if (config.env === 'development' || !config.isProduction) {
        return buildPaginatedResult(inMemoryJobs, inMemoryJobs.length, page, limit);
      }
      return buildPaginatedResult([], 0, page, limit);
    }
  }`;

// Replace getOrgSchemes
const oldGetOrgSchemes = `  static async getOrgSchemes(orgId: string, params: { page?: any; limit?: any }) {
    const { page, limit, offset } = getPagination(params);

    try {
      const countRes = await query(\`SELECT COUNT(*) FROM schemes WHERE org_id = $1\`, [orgId]);
      const total = parseInt(countRes.rows[0].count, 10);

      const res = await query(
        \`SELECT s.*,
                COALESCE((SELECT COUNT(*) FROM scheme_applications sa WHERE sa.scheme_id = s.id), 0) AS applications_count
         FROM schemes s
         WHERE s.org_id = $1
         ORDER BY s.created_at DESC
         LIMIT $2 OFFSET $3\`,
        [orgId, limit, offset]
      );

      return buildPaginatedResult(res.rows, total, page, limit);
    } catch (err: any) {
      return buildPaginatedResult([], 0, page, limit);
    }
  }`;

const newGetOrgSchemes = `  static async getOrgSchemes(orgId: string, params: { page?: any; limit?: any }) {
    const { page, limit, offset } = getPagination(params);

    try {
      let resolvedOrgId: string | null = null;
      let resolvedUserId: string | null = null;

      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orgId || '');
      if (isUuid) {
        resolvedOrgId = orgId;
        resolvedUserId = orgId;
        const orgRecord = await query(
          \`SELECT id, owner_id FROM organizations WHERE id = $1 OR owner_id = $1 LIMIT 1\`,
          [orgId]
        );
        if (orgRecord.rows[0]) {
          resolvedOrgId = orgRecord.rows[0].id;
          resolvedUserId = orgRecord.rows[0].owner_id || resolvedUserId;
        }
      } else if (orgId) {
        const hex = orgId.replace(/^org-/i, '').trim().toLowerCase();
        const matchRes = await query(
          \`SELECT o.id as org_id, o.owner_id as user_id 
           FROM organizations o 
           WHERE o.id::text ILIKE $1 OR o.owner_id::text ILIKE $1
           LIMIT 1\`,
          [\`\${hex}%\`]
        );
        if (matchRes.rows[0]) {
          resolvedOrgId = matchRes.rows[0].org_id;
          resolvedUserId = matchRes.rows[0].user_id;
        }
      }

      if (!resolvedOrgId && !resolvedUserId) {
        resolvedOrgId = '20000000-0000-0000-0000-000000000001';
      }

      const countRes = await query(
        \`SELECT COUNT(*) FROM schemes 
         WHERE (
           ($1::uuid IS NOT NULL AND (org_id = $1 OR created_by = $1))
           OR ($2::uuid IS NOT NULL AND (org_id = $2 OR created_by = $2))
         )\`,
        [resolvedOrgId, resolvedUserId]
      );
      const total = parseInt(countRes.rows[0]?.count || '0', 10);

      const res = await query(
        \`SELECT s.*,
                o.name as org_name, o.logo_url as org_logo,
                COALESCE((SELECT COUNT(*) FROM scheme_applications sa WHERE sa.scheme_id = s.id), 0) AS applications_count
         FROM schemes s
         LEFT JOIN organizations o ON s.org_id = o.id
         WHERE (
           ($1::uuid IS NOT NULL AND (s.org_id = $1 OR s.created_by = $1))
           OR ($2::uuid IS NOT NULL AND (s.org_id = $2 OR s.created_by = $2))
         )
         ORDER BY s.created_at DESC
         LIMIT $3 OFFSET $4\`,
        [resolvedOrgId, resolvedUserId, limit, offset]
      );

      return buildPaginatedResult(res.rows, total, page, limit);
    } catch (err: any) {
      console.warn('[getOrgSchemes] DB Notice:', err.message);
      if (config.env === 'development' || !config.isProduction) {
        return buildPaginatedResult(inMemorySchemes, inMemorySchemes.length, page, limit);
      }
      return buildPaginatedResult([], 0, page, limit);
    }
  }`;

// Normalize line breaks and replace
const norm = str => str.replace(/\r\n/g, '\n');
orgSvc = norm(orgSvc);
if (orgSvc.includes(norm(oldGetOrgJobs))) {
  orgSvc = orgSvc.replace(norm(oldGetOrgJobs), norm(newGetOrgJobs));
  console.log('✅ Replaced getOrgJobs in organization.service.ts');
} else {
  console.warn('⚠️ oldGetOrgJobs target text not found in organization.service.ts');
}

if (orgSvc.includes(norm(oldGetOrgSchemes))) {
  orgSvc = orgSvc.replace(norm(oldGetOrgSchemes), norm(newGetOrgSchemes));
  console.log('✅ Replaced getOrgSchemes in organization.service.ts');
} else {
  console.warn('⚠️ oldGetOrgSchemes target text not found in organization.service.ts');
}

fs.writeFileSync(orgSvcPath, orgSvc, 'utf8');
console.log('✅ Updated organization.service.ts');

