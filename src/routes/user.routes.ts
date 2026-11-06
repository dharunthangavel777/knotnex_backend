import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { authenticate, optionalAuthenticate } from '../middleware/auth.middleware';
import { requireAdmin, requireUserOwnership } from '../middleware/role.middleware';

const router = Router();

router.get('/', authenticate, UserController.listUsers);
router.get('/check-username', optionalAuthenticate, UserController.checkUsernameAvailability);
router.get('/profile', authenticate, UserController.getProfile);
router.get('/me/profile', authenticate, UserController.getProfile);
router.put('/profile', authenticate, UserController.updateProfile);
router.patch('/profile', authenticate, UserController.updateProfile);
router.get('/me/organization', authenticate, UserController.getMyOrganization);
router.get('/:id/public-profile', optionalAuthenticate, UserController.getUserById);
router.get('/:id', optionalAuthenticate, UserController.getUserById);
router.patch('/:id', authenticate, requireUserOwnership('id'), UserController.updateUser);
router.post('/:id/follow', authenticate, UserController.followUser);
router.delete('/:id/follow', authenticate, UserController.unfollowUser);
router.get('/:id/followers', optionalAuthenticate, UserController.getFollowers);
router.get('/:id/following', optionalAuthenticate, UserController.getFollowing);
router.get('/:id/devices', authenticate, requireUserOwnership('id'), UserController.listUserDevices);
router.delete('/:id/devices/:deviceId', authenticate, requireUserOwnership('id'), UserController.removeUserDevice);

export default router;
