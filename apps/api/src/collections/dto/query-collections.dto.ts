import { IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Genre } from '@prisma/client';

export class QueryCollectionsDto {
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

  @ApiPropertyOptional({ enum: Genre })
  @IsOptional()
  @IsEnum(Genre)
  genre?: Genre;

  @ApiPropertyOptional({ description: "Author's century (16 = 1500s), by birth year" })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(21)
  century?: number;

  @ApiPropertyOptional({ description: 'Only authors born before this year (classical heritage: 1800)' })
  @IsOptional()
  @IsInt()
  bornBefore?: number;

  @ApiPropertyOptional({ description: 'Only books with a title in this language (ru, en): language-strict pages' })
  @IsOptional()
  @IsIn(['ru', 'en'])
  titledIn?: 'ru' | 'en';

  @ApiPropertyOptional({ description: 'recent (default), title, year, or size (most works first)' })
  @IsOptional()
  @IsIn(['recent', 'title', 'year', 'size'])
  sort?: 'recent' | 'title' | 'year' | 'size';

  @ApiPropertyOptional({ description: 'At most one collection per author, for varied shelves' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  onePerAuthor?: boolean;
}

export class CollectionViewDto {
  @ApiPropertyOptional({
    description: "Add each work's first line and the book's opening in this UI language where a translation exists",
    enum: ['az', 'ru', 'en'],
  })
  @IsOptional()
  @IsIn(['az', 'ru', 'en'])
  incipit?: 'az' | 'ru' | 'en';
}
