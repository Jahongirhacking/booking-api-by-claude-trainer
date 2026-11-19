import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from 'src/auth/dto/register.dto';
import { ILike, Repository } from 'typeorm';
import { UserEntity } from './entities/user.entity';
import { IUsersQueryOut } from './pipes/users-query.pipe';

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

  async getUserByEmail(
    email: string,
    withCredentials: true,
  ): Promise<UserEntity>;

  async getUserByEmail(
    email: string,
    withCredentials?: false,
  ): Promise<Omit<UserEntity, 'passwordHash'>>;

  async getUserByEmail(email: string, withCredentials: boolean = false) {
    const user = await this.usersRepository.findOne({ where: { email } });
    if (!user) throw new NotFoundException();
    if (withCredentials) return user;
    const { passwordHash: _, ...u } = user;
    return u;
  }

  async registerUser(registerDto: RegisterDto) {
    const foundUser = await this.usersRepository.findOne({
      where: { email: registerDto.email },
    });
    if (foundUser) throw new ConflictException();
    const { password, ...userDto } = registerDto;
    const passwordHash = await bcrypt.hash(password, 10);
    const user = this.usersRepository.create({ ...userDto, passwordHash });
    const { passwordHash: _, ...savedUser } =
      await this.usersRepository.save(user);
    return savedUser;
  }

  async updateUser(userId: string, updateDto: Partial<UserEntity>) {
    const user = await this.usersRepository.preload({
      id: userId,
      ...updateDto,
    });
    if (!user) throw new NotFoundException();
    const { passwordHash: _, ...savedUser } =
      await this.usersRepository.save(user);
    return savedUser;
  }

  async updatePassword(userId: string, password: string) {
    const user = await this.getUserById(userId);
    const passwordHash = await bcrypt.hash(password, 10);
    return this.usersRepository.save({ ...user, passwordHash });
  }

  getUsers(query: IUsersQueryOut) {
    return this.usersRepository.find({
      where: {
        ...(query.search && {
          fullName: ILike(`%${query.search}%`),
        }),
        ...(query.role && {
          role: query.role,
        }),
      },
      skip: query.pagination.skip,
      take: query.pagination.limit,
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });
  }
}
