import { IsOptional, IsEnum, IsIn, IsInt, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AuthorType, Language } from '@prisma/client';

export class QueryAuthorsDto {
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

  @ApiPropertyOptional({ enum: AuthorType })
  @IsOptional()
  @IsEnum(AuthorType)
  type?: AuthorType;

  @ApiPropertyOptional()
  @IsOptional()
  period?: string;

  @ApiPropertyOptional({ enum: Language })
  @IsOptional()
  @IsEnum(Language)
  lang?: Language;

  @ApiPropertyOptional({ description: 'Century number, e.g. 12 for XII' })
  @IsOptional()
  @IsInt()
  century?: number;

  @ApiPropertyOptional({ description: 'First letter for alphabetical filter' })
  @IsOptional()
  letter?: string;

  @ApiPropertyOptional({ description: 'Part of a name, in any of the three languages' })
  @IsOptional()
  q?: string;

  @ApiPropertyOptional({ description: 'Sort order: name (default), recent, or works (most published works first)' })
  @IsOptional()
  @IsIn(['name', 'recent', 'works'])
  sort?: 'name' | 'recent' | 'works';

  @ApiPropertyOptional({ description: 'Only authors with at least this many published works' })
  @IsOptional()
  @IsInt()
  @Min(0)
  minWorks?: number;

  @ApiPropertyOptional({ description: 'Only authors with a name and a work readable in this UI language', enum: ['az', 'ru', 'en'] })
  @IsOptional()
  @IsIn(['az', 'ru', 'en'])
  readableIn?: 'az' | 'ru' | 'en';

  @ApiPropertyOptional({ description: 'Include all statuses (for admin)' })
  @IsOptional()
  all?: string;
}

export class AuthorViewDto {
  @ApiPropertyOptional({
    description:
      'full (default): every collection with every work. page: what the author page shows — books with work counts, the first works outside any book, totals. brief: name, dates and portrait only',
    enum: ['full', 'page', 'brief'],
  })
  @IsOptional()
  @IsIn(['full', 'page', 'brief'])
  view?: 'full' | 'page' | 'brief';
}
