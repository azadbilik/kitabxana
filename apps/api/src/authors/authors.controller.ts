import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AuthorsService } from './authors.service';
import { AuthorViewDto, QueryAuthorsDto } from './dto/query-authors.dto';
import { CreateAuthorDto, UpdateAuthorDto } from './dto/create-author.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { Public } from '../common/decorators/public.decorator';
import { OptionalStaffGuard, staffOnlyAll } from '../common/guards/optional-staff.guard';
import { PublicCache } from '../common/interceptors/public-cache.interceptor';

@ApiTags('Authors')
@Controller('authors')
export class AuthorsController {
  constructor(private authors: AuthorsService) {}

  @Public()
  @UseGuards(OptionalStaffGuard)
  @PublicCache()
  @Get()
  findAll(@Query() query: QueryAuthorsDto, @Req() req: { isStaff?: boolean }) {
    return this.authors.findAll(staffOnlyAll(query, req));
  }

  /** Every published author with a published-work count, for the literature tree (/agac) */
  @Public()
  @Get('tree')
  tree() {
    return this.authors.tree();
  }

  @Public()
  @PublicCache()
  @Get('featured')
  findFeatured(@Query('lang') lang?: string) {
    return this.authors.findFeatured(lang === 'ru' || lang === 'en' ? lang : 'az');
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.EDITOR, UserRole.SUPERADMIN)
  @Get('by-id/:id')
  findById(@Param('id') id: string) {
    return this.authors.findById(id);
  }

  @Public()
  @PublicCache()
  @Get(':slug/artworks')
  artworks(@Param('slug') slug: string) {
    return this.authors.artworksOf(slug);
  }

  @Public()
  @PublicCache()
  @Get(':slug')
  findOne(@Param('slug') slug: string, @Query() query: AuthorViewDto) {
    if (query.view === 'brief') return this.authors.findBrief(slug);
    if (query.view === 'page') return this.authors.findPage(slug);
    return this.authors.findBySlug(slug);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.EDITOR, UserRole.SUPERADMIN)
  @Post()
  create(@Body() dto: CreateAuthorDto) {
    return this.authors.create(dto);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.EDITOR, UserRole.SUPERADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAuthorDto) {
    return this.authors.update(id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.EDITOR, UserRole.SUPERADMIN)
  @Patch(':id/feature')
  setFeatured(@Param('id') id: string) {
    return this.authors.setFeatured(id);
  }
}
