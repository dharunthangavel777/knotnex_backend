import { Response } from 'express';
import { ApiResponseEnvelope, PaginatedResult } from '../types/interfaces';

export class ApiResponse {
  static success<T>(
    res: Response,
    data: T,
    message: string = 'Success',
    statusCode: number = 200,
    meta?: Record<string, any>
  ): Response {
    const payload: ApiResponseEnvelope<T> = {
      success: true,
      message,
      data,
      meta,
    };
    return res.status(statusCode).json(payload);
  }

  static created<T>(
    res: Response,
    data: T,
    message: string = 'Resource created successfully',
    meta?: Record<string, any>
  ): Response {
    return ApiResponse.success(res, data, message, 201, meta);
  }

  static paginated<T>(
    res: Response,
    paginatedResult: PaginatedResult<T>,
    message: string = 'Data retrieved successfully'
  ): Response {
    return res.status(200).json({
      success: true,
      message,
      data: paginatedResult.data,
      pagination: paginatedResult.pagination,
    });
  }

  static error(
    res: Response,
    message: string = 'Internal Server Error',
    statusCode: number = 500,
    code: string = 'SERVER_ERROR',
    details?: any
  ): Response {
    const payload: ApiResponseEnvelope = {
      success: false,
      error: {
        code,
        message,
        details,
      },
    };
    return res.status(statusCode).json(payload);
  }
}
