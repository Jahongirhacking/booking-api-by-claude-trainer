import { Injectable, PipeTransform } from '@nestjs/common';
import {
  IPaginationOut,
  ParsePagination,
} from 'src/common/pipes/parse-pagination.pipe';

export interface IServicesQueryOut {
  pagination: IPaginationOut;
  search: string;
}

@Injectable()
export class ServicesQueryPipe implements PipeTransform {
  transform(value: {
    search: string;
    page: string;
    limit: string;
  }): IServicesQueryOut {
    const pagination = new ParsePagination().transform({
      page: value.page,
      limit: value.limit,
    });
    return {
      pagination,
      search: value.search || '',
    };
  }
}
