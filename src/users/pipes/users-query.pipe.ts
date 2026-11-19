import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import {
  IPaginationOut,
  ParsePagination,
} from 'src/common/pipes/parse-pagination.pipe';
import { UserRole } from '../entities/user.entity';

export interface IUsersQueryOut {
  pagination: IPaginationOut;
  role: UserRole;
  search: string;
}

@Injectable()
export class UsersQueryPipe implements PipeTransform {
  transform(value: {
    role: UserRole;
    search: string;
    page: string;
    limit: string;
  }) {
    const pagination = new ParsePagination().transform({
      page: value.page,
      limit: value.limit,
    });
    if (value.role && !Object.values(UserRole).includes(value.role)) {
      throw new BadRequestException(
        `Role must be one of: ${Object.values(UserRole).join(', ')}`,
      );
    }
    return {
      role: value.role || undefined,
      search: value.search || '',
      pagination,
    };
  }
}
