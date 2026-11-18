import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CollectionViewDto, QueryCollectionsDto } from './dto/query-collections.dto';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CollectionsService } from './collections.service';
import { CreateCollectionDto, UpdateCollectionDto } from './dto/create-collection.dto';
import { PublicCache } from '../common/interceptors/public-cache.interceptor';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Collections')
@Controller('collections')
export class CollectionsController {
  constructor(private collections: CollectionsService) {}

  @Public()
  @PublicCache()
  @Get()
  findAll(@Query() query: QueryCollectionsDto) {
    return this.collections.findAll(query);
  }

  @Public()
  @PublicCache()
  @Get(':slug/artworks')
  artworks(@Param('slug') slug: string) {
    return this.collections.artworksOf(slug);
  }

  @Public()
  @PublicCache()
  @Get(':slug')
  findOne(@Param('slug') slug: string, @Query() query: CollectionViewDto) {
    return this.collections.findBySlug(slug, query.incipit);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.EDITOR, UserRole.SUPERADMIN)
  @Post()
  create(@Body() dto: CreateCollectionDto) {
    return this.collections.create(dto);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.EDITOR, UserRole.SUPERADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCollectionDto) {
    return this.collections.update(id, dto);
  }
}
