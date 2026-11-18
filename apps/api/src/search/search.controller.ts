import { Controller, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { SearchService } from './search.service';
import { SearchGroupsDto, SearchQueryDto } from './dto/search-query.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { Public } from '../common/decorators/public.decorator';
import { VisitorThrottlerGuard } from '../common/guards/client-ip-throttler.guard';
import { PublicCache } from '../common/interceptors/public-cache.interceptor';

@ApiTags('Search')
@Controller('search')
export class SearchController {
  constructor(private search: SearchService) {}

  @Public()
  @UseGuards(VisitorThrottlerGuard)
  @Throttle({ default: { limit: 90, ttl: 60_000 } })
  @PublicCache(60, 120)
  @Get()
  query(@Query() dto: SearchQueryDto) {
    return this.search.search(dto);
  }

  /** Authors and books matching by name or title, shown above the works */
  @Public()
  @UseGuards(VisitorThrottlerGuard)
  @Throttle({ default: { limit: 90, ttl: 60_000 } })
  @PublicCache(60, 300)
  @Get('groups')
  groups(@Query() dto: SearchGroupsDto) {
    return this.search.groups(dto.q);
  }

  /** Starts a full reindex in the background; poll GET /search/reindex for progress */
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.SUPERADMIN)
  @Post('reindex')
  @HttpCode(202)
  reindex() {
    return this.search.startReindex();
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.SUPERADMIN)
  @Get('reindex')
  reindexStatus() {
    return this.search.reindexStatus();
  }
}
