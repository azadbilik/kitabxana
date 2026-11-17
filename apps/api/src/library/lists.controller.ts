import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SessionGuard } from '../account/session.guard';
import type { SessionUser } from '../account/session.service';
import { ListsService, type ListTarget } from './lists.service';

class NameDto {
  @IsString() @MinLength(1) @MaxLength(80) name!: string;
}

class TargetDto {
  @IsOptional() @IsString() @MaxLength(40) workId?: string;
  @IsOptional() @IsString() @MaxLength(40) collectionId?: string;
}

/** Exactly one of a work or a book */
function target(dto: TargetDto): ListTarget {
  if (dto.workId && !dto.collectionId) return { workId: dto.workId };
  if (dto.collectionId && !dto.workId) return { collectionId: dto.collectionId };
  throw new BadRequestException('Give a workId or a collectionId');
}

@ApiTags('Library')
@Controller('me/lists')
@UseGuards(SessionGuard)
export class ListsController {
  constructor(private lists: ListsService) {}

  @Get()
  all(@CurrentUser() user: SessionUser) {
    return this.lists.all(user.id);
  }

  @Post()
  create(@CurrentUser() user: SessionUser, @Body() dto: NameDto) {
    return this.lists.create(user.id, dto.name);
  }

  /** Lists holding a work or book: ?workId= or ?collectionId= */
  @Get('containing')
  containing(@CurrentUser() user: SessionUser, @Query() q: TargetDto) {
    return this.lists.containing(user.id, target(q));
  }

  @Get(':id')
  one(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    return this.lists.one(user.id, id);
  }

  @Patch(':id')
  rename(@CurrentUser() user: SessionUser, @Param('id') id: string, @Body() dto: NameDto) {
    return this.lists.rename(user.id, id, dto.name);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    return this.lists.remove(user.id, id);
  }

  @Put(':id/items')
  add(@CurrentUser() user: SessionUser, @Param('id') id: string, @Body() dto: TargetDto) {
    return this.lists.add(user.id, id, target(dto));
  }

  /** Remove by what it holds (?workId= / ?collectionId=), as the popover does */
  @Delete(':id/items')
  @HttpCode(204)
  removeTarget(@CurrentUser() user: SessionUser, @Param('id') id: string, @Query() q: TargetDto) {
    return this.lists.removeTarget(user.id, id, target(q));
  }

  @Delete(':id/items/:itemId')
  @HttpCode(204)
  removeItem(@CurrentUser() user: SessionUser, @Param('id') id: string, @Param('itemId') itemId: string) {
    return this.lists.removeItem(user.id, id, itemId);
  }
}
