import { Module } from '@nestjs/common';
import { SitemapService } from './sitemap.service';
import { SitemapController } from './sitemap.controller';
import { IndexNowService } from './indexnow.service';

@Module({
  controllers: [SitemapController],
  providers: [SitemapService, IndexNowService],
})
export class SitemapModule {}
