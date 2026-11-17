import { IsEmail, IsIn, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class EmailStartDto {
  @ApiProperty()
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiPropertyOptional({ enum: ['az', 'ru', 'en'] })
  @IsOptional()
  @IsIn(['az', 'ru', 'en'])
  locale?: string;
}

export class EmailVerifyDto {
  @ApiProperty()
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ example: '042917' })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  code: string;

  @ApiPropertyOptional({ enum: ['az', 'ru', 'en'] })
  @IsOptional()
  @IsIn(['az', 'ru', 'en'])
  locale?: string;
}

export class UpdateMeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string | null;

  @ApiPropertyOptional({ enum: ['az', 'ru', 'en'] })
  @IsOptional()
  @IsIn(['az', 'ru', 'en'])
  locale?: string;
}
