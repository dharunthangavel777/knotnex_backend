import { Router } from 'express';

// ─── Feature-First Routes (New Architecture) ─────────────────────────────────
import authRoutes from '../features/auth/auth.routes';

// ─── Layered Routes (Existing — kept for compatibility) ──────────────────────
import userRoutes from './user.routes';
import profileRoutes from './profile.routes';
import organizationRoutes from './organization.routes';
import eventRoutes from './event.routes';
import registrationRoutes from './registration.routes';
import jobRoutes from './job.routes';
import applicationRoutes from './application.routes';
import schemeRoutes from './scheme.routes';
import postRoutes from './post.routes';
import chatRoutes from './chat.routes';
import notificationRoutes from './notification.routes';
import ticketRoutes from './ticket.routes';
import searchRoutes from './search.routes';
import uploadRoutes from './upload.routes';
import analyticsRoutes from './analytics.routes';
import adminRoutes from './admin.routes';
import healthRoutes from './health.routes';

const masterRouter = Router();

// ─── Health ───────────────────────────────────────────────────────────────────
masterRouter.use('/health', healthRoutes);

// ─── Auth (Feature-First implementation) ─────────────────────────────────────
masterRouter.use('/auth', authRoutes);

// ─── User / Profile ───────────────────────────────────────────────────────────
masterRouter.use('/users', userRoutes);
masterRouter.use('/profiles', profileRoutes);

// ─── Organization ─────────────────────────────────────────────────────────────
masterRouter.use('/organizations', organizationRoutes);

// ─── Events & Registrations ───────────────────────────────────────────────────
masterRouter.use('/events', eventRoutes);
masterRouter.use('/registrations', registrationRoutes);

// ─── Jobs & Applications ─────────────────────────────────────────────────────
masterRouter.use('/jobs', jobRoutes);
masterRouter.use('/applications', applicationRoutes);

// ─── Schemes ──────────────────────────────────────────────────────────────────
masterRouter.use('/schemes', schemeRoutes);

// ─── Community / Posts ────────────────────────────────────────────────────────
masterRouter.use('/posts', postRoutes);

// ─── Real-time Chat ───────────────────────────────────────────────────────────
masterRouter.use('/chat', chatRoutes);

// ─── Notifications ────────────────────────────────────────────────────────────
masterRouter.use('/notifications', notificationRoutes);

// ─── Support Tickets ──────────────────────────────────────────────────────────
masterRouter.use('/tickets', ticketRoutes);

// ─── Search ───────────────────────────────────────────────────────────────────
masterRouter.use('/search', searchRoutes);

// ─── File Uploads ─────────────────────────────────────────────────────────────
masterRouter.use('/uploads', uploadRoutes);

// ─── Analytics ────────────────────────────────────────────────────────────────
masterRouter.use('/analytics', analyticsRoutes);

// ─── Admin ────────────────────────────────────────────────────────────────────
masterRouter.use('/admin', adminRoutes);

export default masterRouter;
