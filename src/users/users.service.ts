import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
  ) {}

  async getUserById(id: string, withCredentials: boolean = false) {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException();
    if (withCredentials) return user;
    const { passwordHash: _, ...u } = user;
    return u;
  }
}
