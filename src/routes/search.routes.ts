import { Router } from 'express';
import { SearchController } from '../controllers/search.controller';
import { optionalAuthenticate } from '../middleware/auth.middleware';

const router = Router();

router.get('/', optionalAuthenticate, SearchController.universalSearch);

export default router;
