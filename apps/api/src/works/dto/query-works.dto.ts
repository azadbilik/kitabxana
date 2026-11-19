import { IsOptional, IsEnum, IsIn, IsInt, IsString, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Genre, Language, PoemForm } from '@prisma/client';

export class QueryWorksDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  authorSlug?: string;

  @ApiPropertyOptional({ description: 'Tag slug (theme, mood, audience or era)' })
  @IsOptional()
  @IsString()
  tag?: string;

  @ApiPropertyOptional({ description: 'Title contains (any language), case-insensitive' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ enum: Genre })
  @IsOptional()
  @IsEnum(Genre)
  genre?: Genre;

  @ApiPropertyOptional({ enum: PoemForm })
  @IsOptional()
  @IsEnum(PoemForm)
  form?: PoemForm;

  @ApiPropertyOptional({ enum: Language })
  @IsOptional()
  @IsEnum(Language)
  lang?: Language;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  yearFrom?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  yearTo?: number;

  @ApiPropertyOptional({
    description:
      'Sort order: year (default), recent, title (alphabetical in titleLang), or popular (each author\'s most-read works in turn, most-read authors first)',
  })
  @IsOptional()
  @IsIn(['year', 'recent', 'title', 'popular'])
  sort?: 'year' | 'recent' | 'title' | 'popular';

  @ApiPropertyOptional({ description: 'With sort=title: the UI language whose titles are sorted (falling back to the Azerbaijani title)', enum: ['az', 'ru', 'en'] })
  @IsOptional()
  @IsIn(['az', 'ru', 'en'])
  titleLang?: 'az' | 'ru' | 'en';

  @ApiPropertyOptional({ description: 'Add each work\'s opening lines, preferring a translation into this UI language', enum: ['az', 'ru', 'en'] })
  @IsOptional()
  @IsIn(['az', 'ru', 'en'])
  incipit?: 'az' | 'ru' | 'en';

  @ApiPropertyOptional({
    description: 'Reading time: short (up to 5 min), medium (6–15), long (16–59), book (an hour or more)',
    enum: ['short', 'medium', 'long', 'book'],
  })
  @IsOptional()
  @IsIn(['short', 'medium', 'long', 'book'])
  time?: 'short' | 'medium' | 'long' | 'book';

  @ApiPropertyOptional({ description: 'Only works readable in full in this UI language (title and text)', enum: ['az', 'ru', 'en'] })
  @IsOptional()
  @IsIn(['az', 'ru', 'en'])
  readableIn?: 'az' | 'ru' | 'en';

  @ApiPropertyOptional({ description: 'Include all statuses (for admin)' })
  @IsOptional()
  all?: string;
}
