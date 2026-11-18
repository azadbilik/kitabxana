import {
  Controller,
  Get,
  Header,
  Post,
  Patch,
  Param,
  ParseIntPipe,
  Query,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { WorksService, type UiLang } from './works.service';
import { CreateWorkDto, UpdateWorkDto } from './dto/create-work.dto';
import { QueryWorksDto } from './dto/query-works.dto';
import { SetWorkTagsDto } from './dto/set-work-tags.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { Public } from '../common/decorators/public.decorator';
import { OptionalStaffGuard, staffOnlyAll } from '../common/guards/optional-staff.guard';
import { PublicCache } from '../common/interceptors/public-cache.interceptor';

@ApiTags('Works')
@Controller('works')
export class WorksController {
  constructor(private works: WorksService) {}

  @Public()
  @UseGuards(OptionalStaffGuard)
  @PublicCache()
  @Get()
  findAll(@Query() query: QueryWorksDto, @Req() req: { isStaff?: boolean }) {
    return this.works.findAll(staffOnlyAll(query, req));
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.EDITOR, UserRole.SUPERADMIN)
  @Get('by-id/:id')
  findById(@Param('id') id: string) {
    return this.works.findById(id);
  }

  @Public()
  @Header('Cache-Control', 'no-store')
  @Get('random')
  random(@Query('lang') lang?: string) {
    return this.works.random(uiLang(lang));
  }

  @Public()
  @PublicCache()
  @Get('catalog')
  catalog() {
    return this.works.catalog();
  }

  @Public()
  @PublicCache()
  @Get('daily')
  poemOfTheDay(@Query('lang') lang?: string) {
    return this.works.poemOfTheDay(uiLang(lang));
  }

  @Public()
  @PublicCache()
  @Get('resolve/:slug')
  resolve(@Param('slug') slug: string) {
    return this.works.resolveSlug(slug);
  }

  @Public()
  @PublicCache()
  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.works.findBySlug(slug);
  }

  @Public()
  @PublicCache()
  @Get(':slug/more')
  moreByAuthor(@Param('slug') slug: string, @Query('locale') locale?: string) {
    return this.works.moreByAuthor(slug, locale);
  }

  @Public()
  @PublicCache()
  @Get(':slug/others')
  byOtherPoets(@Param('slug') slug: string, @Query('locale') locale?: string) {
    return this.works.byOtherPoets(slug, locale);
  }

  @Public()
  @PublicCache()
  @Get(':slug/nav')
  getNav(@Param('slug') slug: string) {
    return this.works.getNav(slug);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.EDITOR, UserRole.SUPERADMIN)
  @Post()
  create(@Body() dto: CreateWorkDto) {
    return this.works.create(dto);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.EDITOR, UserRole.SUPERADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateWorkDto) {
    return this.works.update(id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.EDITOR, UserRole.SUPERADMIN)
  @Patch(':id/tags')
  setTags(@Param('id') id: string, @Body() dto: SetWorkTagsDto) {
    return this.works.setTags(id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.EDITOR, UserRole.SUPERADMIN)
  @Patch(':id/reorder')
  reorder(@Param('id') id: string, @Body('order', ParseIntPipe) order: number) {
    return this.works.reorder(id, order);
  }
}

/** A UI language from a query param; anything else is Azerbaijani */
function uiLang(lang: string | undefined): UiLang {
  return lang === 'ru' || lang === 'en' ? lang : 'az';
}
