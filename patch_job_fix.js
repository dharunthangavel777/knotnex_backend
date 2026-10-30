const fs = require('fs');
const path = require('path');

const jobSvcPath = path.resolve(__dirname, 'src/services/job.service.ts');
let jobSvc = fs.readFileSync(jobSvcPath, 'utf8');

// 1. Fix the missing $ in listJobs
jobSvc = jobSvc.replace(
  'conditions.push(`j.status = ${idx++}`);',
  'conditions.push(`j.status = $${idx++}`);'
);
jobSvc = jobSvc.replace(
  'conditions.push(`j.org_id = ${idx++}`);',
  'conditions.push(`j.org_id = $${idx++}`);'
);

// 2. Sanitize type & locationType and handle targetUserId null in createJob
const oldCreateJobStart = `  static async createJob(orgId: string, userId: string, data: any) {
    let targetOrgId = orgId;
    if (!targetOrgId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetOrgId)) {
      targetOrgId = '20000000-0000-0000-0000-000000000001';
    }
    let targetUserId = userId;
    if (!targetUserId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetUserId)) {
      targetUserId = '00000000-0000-0000-0000-000000000001';
    }
    const title = data.title || data.role || 'Untitled Opportunity';
    const department = data.department || data.dept || 'General';
    const type = data.type ? data.type.toLowerCase().replace(' ', '-') : 'full-time';
    const locationType = data.locationType || (data.location && data.location.toLowerCase().includes('remote') ? 'remote' : 'on-site');`;

const newCreateJobStart = `  static async createJob(orgId: string, userId: string, data: any) {
    let targetOrgId = orgId;
    if (!targetOrgId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetOrgId)) {
      targetOrgId = '20000000-0000-0000-0000-000000000001';
    }
    let targetUserId = userId;
    if (!targetUserId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetUserId)) {
      targetUserId = null;
    }
    const title = data.title || data.role || 'Untitled Opportunity';
    const department = data.department || data.dept || 'General';
    
    // Strict schema check constraint enforcement for type
    let rawType = (data.type || 'full-time').toLowerCase().trim().replace(/\\s+/g, '-');
    const allowedTypes = ['full-time', 'part-time', 'internship', 'volunteer', 'contract'];
    const type = allowedTypes.includes(rawType) ? rawType : 'full-time';

    // Strict schema check constraint enforcement for location_type
    let rawLoc = (data.locationType || data.location_type || (data.location && data.location.toLowerCase().includes('remote') ? 'remote' : 'on-site')).toLowerCase().trim();
    if (rawLoc === 'onsite') rawLoc = 'on-site';
    const locationType = ['remote', 'on-site', 'hybrid'].includes(rawLoc) ? rawLoc : (rawLoc.includes('remote') ? 'remote' : (rawLoc.includes('hybrid') ? 'hybrid' : 'on-site'));`;

const norm = s => s.replace(/\r\n/g, '\n');
jobSvc = norm(jobSvc).replace(norm(oldCreateJobStart), norm(newCreateJobStart));

// 3. Graceful handling of non-UUID IDs in getJobById, updateJob, deleteJob
const oldGetJobById = `  static async getJobById(id: string) {
    try {
      const res = await query(
        \`SELECT j.*, o.name as org_name, o.logo_url as org_logo, o.about as org_about, o.website as org_website
         FROM jobs j
         JOIN organizations o ON j.org_id = o.id
         WHERE j.id = $1\`,
        [id]
      );
      return res.rows[0] ? formatJobResponse(res.rows[0]) : null;
    } catch (err: any) {
      if (config.env === 'development' || !config.isProduction) {
        const found = inMemoryJobs.find((j: any) => String(j.id) === String(id));
        return found ? formatJobResponse(found) : null;
      }
      throw err;
    }
  }`;

const newGetJobById = `  static async getJobById(id: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id || '');
    if (!isUuid) {
      const found = inMemoryJobs.find((j: any) => String(j.id) === String(id));
      return found ? formatJobResponse(found) : null;
    }
    try {
      const res = await query(
        \`SELECT j.*, o.name as org_name, o.logo_url as org_logo, o.about as org_about, o.website as org_website
         FROM jobs j
         JOIN organizations o ON j.org_id = o.id
         WHERE j.id = $1\`,
        [id]
      );
      return res.rows[0] ? formatJobResponse(res.rows[0]) : null;
    } catch (err: any) {
      const found = inMemoryJobs.find((j: any) => String(j.id) === String(id));
      return found ? formatJobResponse(found) : null;
    }
  }`;

jobSvc = jobSvc.replace(norm(oldGetJobById), norm(newGetJobById));

// In updateJob:
const oldUpdateStart = `  static async updateJob(id: string, data: any) {`;
const newUpdateStart = `  static async updateJob(id: string, data: any) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id || '');
    if (!isUuid) {
      const job = inMemoryJobs.find((j: any) => String(j.id) === String(id));
      if (job) {
        Object.assign(job, data, { updated_at: new Date().toISOString() });
        return formatJobResponse(job);
      }
      return null;
    }`;

jobSvc = jobSvc.replace(norm(oldUpdateStart), norm(newUpdateStart));

// In deleteJob:
const oldDeleteStart = `  static async deleteJob(id: string) {
    try {
      await query(\`DELETE FROM jobs WHERE id = $1\`, [id]);
      return { success: true };
    }`;

const newDeleteStart = `  static async deleteJob(id: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id || '');
    if (!isUuid) {
      const idx = inMemoryJobs.findIndex((j: any) => String(j.id) === String(id));
      if (idx !== -1) inMemoryJobs.splice(idx, 1);
      return { success: true };
    }
    try {
      await query(\`DELETE FROM jobs WHERE id = $1\`, [id]);
      return { success: true };
    }`;

jobSvc = jobSvc.replace(norm(oldDeleteStart), norm(newDeleteStart));

fs.writeFileSync(jobSvcPath, jobSvc, 'utf8');
console.log('✅ Patched job.service.ts');

// 4. Also sanitize scheme.service.ts
const schemeSvcPath = path.resolve(__dirname, 'src/services/scheme.service.ts');
let schemeSvc = fs.readFileSync(schemeSvcPath, 'utf8');

// In createScheme, set targetUserId = null if invalid UUID
schemeSvc = schemeSvc.replace(
  `let targetUserId = userId;\n    if (!targetUserId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetUserId)) {\n      targetUserId = '00000000-0000-0000-0000-000000000001';\n    }`,
  `let targetUserId = userId;\n    if (!targetUserId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetUserId)) {\n      targetUserId = null;\n    }`
);

// In getSchemeById, updateScheme, deleteScheme handle non-UUID:
const oldGetSchemeById = `  static async getSchemeById(id: string) {
    try {
      const res = await query(
        \`SELECT s.*, o.name as org_name, o.logo_url as org_logo,
                COALESCE((SELECT COUNT(*) FROM scheme_applications sa WHERE sa.scheme_id = s.id), 0) AS applications_count
         FROM schemes s
         LEFT JOIN organizations o ON s.org_id = o.id
         WHERE s.id = $1\`,
        [id]
      );
      return res.rows[0] ? formatSchemeResponse(res.rows[0]) : null;
    } catch (dbErr: any) {
      if (config.env === 'development' || !config.isProduction) {
        const found = inMemorySchemes.find(s => s.id === id);
        return found ? formatSchemeResponse(found) : null;
      }
      throw dbErr;
    }
  }`;

const newGetSchemeById = `  static async getSchemeById(id: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id || '');
    if (!isUuid) {
      const found = inMemorySchemes.find(s => String(s.id) === String(id));
      return found ? formatSchemeResponse(found) : null;
    }
    try {
      const res = await query(
        \`SELECT s.*, o.name as org_name, o.logo_url as org_logo,
                COALESCE((SELECT COUNT(*) FROM scheme_applications sa WHERE sa.scheme_id = s.id), 0) AS applications_count
         FROM schemes s
         LEFT JOIN organizations o ON s.org_id = o.id
         WHERE s.id = $1\`,
        [id]
      );
      return res.rows[0] ? formatSchemeResponse(res.rows[0]) : null;
    } catch (dbErr: any) {
      const found = inMemorySchemes.find(s => String(s.id) === String(id));
      return found ? formatSchemeResponse(found) : null;
    }
  }`;

schemeSvc = norm(schemeSvc).replace(norm(oldGetSchemeById), norm(newGetSchemeById));

// In updateScheme:
const oldUpdateSchemeStart = `  static async updateScheme(id: string, data: any) {`;
const newUpdateSchemeStart = `  static async updateScheme(id: string, data: any) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id || '');
    if (!isUuid) {
      const sIdx = inMemorySchemes.findIndex(s => String(s.id) === String(id));
      if (sIdx !== -1) {
        inMemorySchemes[sIdx] = { ...inMemorySchemes[sIdx], ...data, updated_at: new Date().toISOString() };
        return formatSchemeResponse(inMemorySchemes[sIdx]);
      }
      return null;
    }`;

schemeSvc = schemeSvc.replace(norm(oldUpdateSchemeStart), norm(newUpdateSchemeStart));

// In deleteScheme:
const oldDeleteSchemeStart = `  static async deleteScheme(id: string) {
    try {
      await query(\`DELETE FROM schemes WHERE id = $1\`, [id]);
      return { success: true };
    }`;

const newDeleteSchemeStart = `  static async deleteScheme(id: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id || '');
    if (!isUuid) {
      const idx = inMemorySchemes.findIndex(s => String(s.id) === String(id));
      if (idx !== -1) inMemorySchemes.splice(idx, 1);
      return { success: true };
    }
    try {
      await query(\`DELETE FROM schemes WHERE id = $1\`, [id]);
      return { success: true };
    }`;

schemeSvc = schemeSvc.replace(norm(oldDeleteSchemeStart), norm(newDeleteSchemeStart));

fs.writeFileSync(schemeSvcPath, schemeSvc, 'utf8');
console.log('✅ Patched scheme.service.ts');

