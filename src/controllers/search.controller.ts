import { Request, Response } from 'express';
import { SearchService } from '../services/search.service';
import { ApiResponse } from '../utils/response.util';

export class SearchController {
  static async universalSearch(req: Request, res: Response) {
    try {
      const q = (req.query.q as string) || '';
      if (!q.trim()) {
        return ApiResponse.success(res, { query: '', events: [], jobs: [], organizations: [], schemes: [] });
      }

      const results = await SearchService.universalSearch(q);
      return ApiResponse.success(res, results);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }
}
