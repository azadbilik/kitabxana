import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SitemapService } from './sitemap.service';
import { Public } from '../common/decorators/public.decorator';
import { PublicCache } from '../common/interceptors/public-cache.interceptor';

@ApiTags('Sitemap')
@Controller('sitemap')
export class SitemapController {
  constructor(private sitemap: SitemapService) {}

  @Public()
  @PublicCache(600, 600)
  @Get()
  entries() {
    return this.sitemap.entries();
  }
}
