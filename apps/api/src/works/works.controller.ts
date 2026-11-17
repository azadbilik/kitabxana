import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { WorksService, type UiLang } from './works.service';
import { CreateWorkDto } from './dto/create-work.dto';
import { QueryWorksDto } from './dto/query-works.dto';
import { SetWorkTagsDto } from './dto/set-work-tags.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Works')
@Controller('works')
export class WorksController {
  constructor(private works: WorksService) {}

  @Public()
  @Get()
  findAll(@Query() query: QueryWorksDto) {
    return this.works.findAll(query);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.EDITOR, UserRole.SUPERADMIN)
  @Get('by-id/:id')
  findById(@Param('id') id: string) {
    return this.works.findById(id);
  }

  @Public()
  @Get('random')
  random(@Query('lang') lang?: string) {
    return this.works.random(uiLang(lang));
  }

  @Public()
  @Get('catalog')
  catalog() {
    return this.works.catalog();
  }

  @Public()
  @Get('daily')
  poemOfTheDay(@Query('lang') lang?: string) {
    return this.works.poemOfTheDay(uiLang(lang));
  }

  @Public()
  @Get('resolve/:slug')
  resolve(@Param('slug') slug: string) {
    return this.works.resolveSlug(slug);
  }

  @Public()
  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.works.findBySlug(slug);
  }

  @Public()
  @Get(':slug/more')
  moreByAuthor(@Param('slug') slug: string, @Query('locale') locale?: string) {
    return this.works.moreByAuthor(slug, locale);
  }

  @Public()
  @Get(':slug/others')
  byOtherPoets(@Param('slug') slug: string, @Query('locale') locale?: string) {
    return this.works.byOtherPoets(slug, locale);
  }

  @Public()
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
  update(@Param('id') id: string, @Body() dto: Partial<CreateWorkDto>) {
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
  reorder(@Param('id') id: string, @Body('order') order: number) {
    return this.works.reorder(id, order);
  }
}

/** A UI language from a query param; anything else is Azerbaijani */
function uiLang(lang: string | undefined): UiLang {
  return lang === 'ru' || lang === 'en' ? lang : 'az';
}
