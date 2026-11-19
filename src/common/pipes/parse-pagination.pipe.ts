import { BadRequestException, PipeTransform } from '@nestjs/common';

const DEFAULT_PAGE = 1,
  DEFAULT_LIMIT = 20;

export interface IPaginationOut {
  page: number;
  limit: number;
  skip: number;
}

export class ParsePagination implements PipeTransform {
  transform(value: { page: string; limit: string }): IPaginationOut {
    const page = value.page ? Number(value.page) : DEFAULT_PAGE;
    const limit = value.limit ? Number(value.limit) : DEFAULT_LIMIT;
    if (
      !Number.isInteger(page) ||
      page <= 0 ||
      !Number.isInteger(limit) ||
      limit <= 0
    )
      throw new BadRequestException();
    return {
      page,
      limit,
      skip: (page - 1) * limit,
    };
  }
}
