import { PaginationParams, PaginatedResult } from '../types/interfaces';

export const getPagination = (params: { page?: any; limit?: any }): { page: number; limit: number; offset: number } => {
  const page = Math.max(1, parseInt(params.page || '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(params.limit || '10', 10) || 10));
  const offset = (page - 1) * limit;

  return { page, limit, offset };
};

export const buildPaginatedResult = <T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): PaginatedResult<T> => {
  const totalPages = Math.ceil(total / limit) || 1;
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
};
