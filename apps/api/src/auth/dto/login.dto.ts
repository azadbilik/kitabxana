import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'user@irs.az' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(6)
  // bcrypt reads 72 bytes; longer input only costs CPU
  @MaxLength(200)
  password: string;
}

export class RefreshDto {
  @ApiProperty()
  @IsString()
  @MaxLength(2000)
  refreshToken: string;
}
