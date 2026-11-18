import { Body, Controller, Delete, Get, HttpCode, Param, ParseEnumPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SessionGuard } from '../account/session.guard';
import type { SessionUser } from '../account/session.service';
import { LibraryService } from './library.service';

class StateDto {
  @IsOptional() @IsArray() @ArrayMaxSize(1000) @IsString({ each: true }) workIds?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(200) @IsString({ each: true }) collectionIds?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(200) @IsString({ each: true }) authorIds?: string[];
}

class ReadingDto {
  /** READING, DONE, or null to clear the mark */
  @IsOptional() @IsIn(['READING', 'DONE', null]) status?: 'READING' | 'DONE' | null;
  @IsOptional() @IsNumber() @Min(0) @Max(1) progress?: number;
  @IsOptional() @IsString() @MaxLength(40) translationId?: string | null;
}

class BookDto {
  @IsIn(['WANT', 'READING', 'DONE', null]) status!: 'WANT' | 'READING' | 'DONE' | null;
}

class ImportItem {
  @IsString() @MaxLength(200) slug!: string;
  @IsNumber() @Min(0) @Max(1) progress!: number;
}
class ImportDto {
  @IsArray() @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => ImportItem) items!: ImportItem[];
}

enum Kind {
  work = 'work',
  book = 'book',
  author = 'author',
}

@ApiTags('Library')
@Controller('me')
@UseGuards(SessionGuard)
export class LibraryController {
  constructor(private library: LibraryService) {}

  /** POST, since a page can ask about hundreds of ids at once */
  @Post('state')
  @HttpCode(200)
  state(@CurrentUser() user: SessionUser, @Body() dto: StateDto) {
    return this.library.state(user.id, dto);
  }

  @Put('favorites/:kind/:id')
  save(@CurrentUser() user: SessionUser, @Param('kind', new ParseEnumPipe(Kind)) kind: Kind, @Param('id') id: string) {
    return this.library.setFavorite(user.id, kind, id, true);
  }

  @Delete('favorites/:kind/:id')
  unsave(@CurrentUser() user: SessionUser, @Param('kind', new ParseEnumPipe(Kind)) kind: Kind, @Param('id') id: string) {
    return this.library.setFavorite(user.id, kind, id, false);
  }

  /** Also sent with fetch keepalive when a reader leaves the page */
  @Put('reading/:workId')
  reading(@CurrentUser() user: SessionUser, @Param('workId') workId: string, @Body() dto: ReadingDto) {
    return this.library.setReading(user.id, workId, dto);
  }

  @Post('reading/import')
  @HttpCode(200)
  importPositions(@CurrentUser() user: SessionUser, @Body() dto: ImportDto) {
    return this.library.importPositions(user.id, dto.items);
  }

  @Put('books/:collectionId')
  book(@CurrentUser() user: SessionUser, @Param('collectionId') collectionId: string, @Body() dto: BookDto) {
    return this.library.setBook(user.id, collectionId, dto.status);
  }

  @Get('continue')
  continueReading(@CurrentUser() user: SessionUser) {
    return this.library.continueReading(user.id);
  }

  @Get('shelf')
  shelf(@CurrentUser() user: SessionUser, @Query('tab') tab = 'reading', @Query('page') page = '1') {
    return this.library.shelf(user.id, tab, Number(page) || 1);
  }

  /** Works read and in progress per author, for the literature tree */
  @Get('map')
  map(@CurrentUser() user: SessionUser) {
    return this.library.map(user.id);
  }

  @Get('shelf/counts')
  counts(@CurrentUser() user: SessionUser) {
    return this.library.counts(user.id);
  }
}
