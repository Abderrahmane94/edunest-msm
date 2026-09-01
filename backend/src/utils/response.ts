/**
 * Standardized API response envelope utilities.
 * All API responses follow a consistent format for success and error cases.
 */

export interface FieldError {
  field: string;
  message: string;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: { pagination: PaginationMeta };
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: FieldError[];
    meta?: Record<string, unknown>;
  };
}

export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

/**
 * Creates a standardized success response object.
 */
export function successResponse<T>(data: T, meta?: { pagination: PaginationMeta }): SuccessResponse<T> {
  const response: SuccessResponse<T> = { success: true, data };
  if (meta) {
    response.meta = meta;
  }
  return response;
}

/**
 * Creates a standardized error response object.
 */
export function errorResponse(
  code: string,
  message: string,
  details?: FieldError[],
  meta?: Record<string, unknown>,
): ErrorResponse {
  const response: ErrorResponse = {
    success: false,
    error: { code, message },
  };
  if (details) {
    response.error.details = details;
  }
  if (meta) {
    response.error.meta = meta;
  }
  return response;
}

/**
 * Creates a standardized paginated success response object.
 */
export function paginatedResponse<T>(
  data: T,
  page: number,
  pageSize: number,
  total: number,
): SuccessResponse<T> {
  const totalPages = Math.ceil(total / pageSize);
  return successResponse(data, {
    pagination: { page, pageSize, total, totalPages },
  });
}
