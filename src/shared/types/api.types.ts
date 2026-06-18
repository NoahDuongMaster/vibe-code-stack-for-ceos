export type TApiResponse<T> = {
  data: T;
  message: string;
  success: boolean;
};

export type TApiError = {
  message: string;
  code: string;
  statusCode: number;
};

export type TPaginatedResponse<T> = TApiResponse<{
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}>;

export type TPaginationQuery = {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
};
