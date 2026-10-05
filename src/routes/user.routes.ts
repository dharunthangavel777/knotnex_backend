import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { authenticate, optionalAuthenticate } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/role.middleware';

const router = Router();

router.get('/', authenticate, UserController.listUsers);
router.get('/profile', authenticate, UserController.getProfile);
router.put('/profile', authenticate, UserController.updateProfile);
router.patch('/profile', authenticate, UserController.updateProfile);
router.get('/:id', optionalAuthenticate, UserController.getUserById);
router.patch('/:id', authenticate, UserController.updateUser);
router.post('/:id/follow', authenticate, UserController.followUser);
router.delete('/:id/follow', authenticate, UserController.unfollowUser);
router.get('/:id/followers', optionalAuthenticate, UserController.getFollowers);
router.get('/:id/following', optionalAuthenticate, UserController.getFollowing);
router.get('/:id/devices', authenticate, UserController.listUserDevices);
router.delete('/:id/devices/:deviceId', authenticate, UserController.removeUserDevice);

export default router;
