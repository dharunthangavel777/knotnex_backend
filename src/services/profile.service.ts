import { query } from '../config/database';
import { QrGenerator } from '../integrations/qr/qr-generator';

export class ProfileService {
  static async getProfileByUserId(userId: string) {
    const res = await query(
      `SELECT u.id, u.full_name, u.email, u.phone, u.avatar_url, u.role, u.is_verified,
              p.bio, p.date_of_birth, p.gender, p.district, p.state, p.pincode,
              p.disability_type, p.education, p.skills, p.languages, p.social_links,
              p.accessibility, p.cover_url, p.qr_code_url, p.created_at, p.updated_at
       FROM users u
       LEFT JOIN user_profiles p ON u.id = p.user_id
       WHERE u.id = $1`,
      [userId]
    );

    return res.rows[0] || null;
  }

  static async updateProfile(userId: string, data: any) {
    // 1. Update users table if fullName or avatarUrl provided
    if (data.fullName || data.avatarUrl) {
      await query(
        `UPDATE users SET full_name = COALESCE($1, full_name), avatar_url = COALESCE($2, avatar_url), updated_at = NOW() WHERE id = $3`,
        [data.fullName || null, data.avatarUrl || null, userId]
      );
    }

    // 2. Upsert user_profiles
    const res = await query(
      `INSERT INTO user_profiles (
         user_id, bio, date_of_birth, gender, district, state, pincode,
         disability_type, education, skills, languages, social_links, accessibility, cover_url, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         bio = COALESCE(EXCLUDED.bio, user_profiles.bio),
         date_of_birth = COALESCE(EXCLUDED.date_of_birth, user_profiles.date_of_birth),
         gender = COALESCE(EXCLUDED.gender, user_profiles.gender),
         district = COALESCE(EXCLUDED.district, user_profiles.district),
         state = COALESCE(EXCLUDED.state, user_profiles.state),
         pincode = COALESCE(EXCLUDED.pincode, user_profiles.pincode),
         disability_type = COALESCE(EXCLUDED.disability_type, user_profiles.disability_type),
         education = COALESCE(EXCLUDED.education, user_profiles.education),
         skills = COALESCE(EXCLUDED.skills, user_profiles.skills),
         languages = COALESCE(EXCLUDED.languages, user_profiles.languages),
         social_links = COALESCE(EXCLUDED.social_links, user_profiles.social_links),
         accessibility = COALESCE(EXCLUDED.accessibility, user_profiles.accessibility),
         cover_url = COALESCE(EXCLUDED.cover_url, user_profiles.cover_url),
         updated_at = NOW()
       RETURNING *`,
      [
        userId,
        data.bio || null,
        data.dateOfBirth || null,
        data.gender || null,
        data.district || null,
        data.state || null,
        data.pincode || null,
        data.disabilityType || null,
        JSON.stringify(data.education || []),
        data.skills || [],
        data.languages || [],
        JSON.stringify(data.socialLinks || {}),
        JSON.stringify(data.accessibility || {}),
        data.coverUrl || null,
      ]
    );

    return res.rows[0];
  }

  static async generateProfileQr(userId: string) {
    const payload = JSON.stringify({ knotnexProfileId: userId });
    const qrDataUrl = await QrGenerator.generateDataUrl(payload);

    await query(
      `UPDATE user_profiles SET qr_code_url = $1 WHERE user_id = $2`,
      [qrDataUrl, userId]
    );

    return { qrCodeUrl: qrDataUrl };
  }

  static async getDashboardStats(userId: string) {
    const eventsCount = await query(
      `SELECT COUNT(*) FROM event_registrations WHERE user_id = $1`,
      [userId]
    );
    const jobsCount = await query(
      `SELECT COUNT(*) FROM job_applications WHERE applicant_id = $1`,
      [userId]
    );
    const schemesCount = await query(
      `SELECT COUNT(*) FROM scheme_applications WHERE applicant_id = $1`,
      [userId]
    );
    const savedCount = await query(
      `SELECT COUNT(*) FROM saved_items WHERE user_id = $1`,
      [userId]
    );

    return {
      registeredEvents: parseInt(eventsCount.rows[0].count, 10),
      appliedJobs: parseInt(jobsCount.rows[0].count, 10),
      appliedSchemes: parseInt(schemesCount.rows[0].count, 10),
      savedItems: parseInt(savedCount.rows[0].count, 10),
    };
  }
}
