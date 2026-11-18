import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const publicSelect = {
  id: true,
  email: true,
  username: true,
  name: true,
  role: true,
  avatarUrl: true,
  bio: true,
  isVerified: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  create(data: Prisma.UserCreateInput) {
    return this.prisma.user.create({ data });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: publicSelect,
    });
  }

  /** What decides whether a staff token may still be issued for this account */
  findAuthState(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, isBanned: true, passwordHash: true },
    });
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findByUsername(username: string) {
    return this.prisma.user.findUnique({ where: { username } });
  }
}
