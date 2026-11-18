import { IsString, IsOptional, IsEnum, IsIn, IsInt, Max, MaxLength, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Genre, Language } from '@prisma/client';

export class SearchQueryDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  q: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  authorSlug?: string;

  @ApiPropertyOptional({ enum: Genre })
  @IsOptional()
  @IsEnum(Genre)
  genre?: Genre;

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

  /** '1': only works with a published translation (ignored until the index has the attribute) */
  @ApiPropertyOptional({ enum: ['1'] })
  @IsOptional()
  @IsIn(['1'])
  translated?: '1';

  /** '1': also return `facets`: counts by author, genre and original language for the query */
  @ApiPropertyOptional({ enum: ['1'] })
  @IsOptional()
  @IsIn(['1'])
  facets?: '1';
}

export class SearchGroupsDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  q: string;
}
