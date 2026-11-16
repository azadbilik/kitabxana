import { Module } from '@nestjs/common';
import { WorksService } from './works.service';
import { WorksController } from './works.controller';
import { SearchModule } from '../search/search.module';
import { DownloadsModule } from '../downloads/downloads.module';

@Module({
  imports: [SearchModule, DownloadsModule],
  controllers: [WorksController],
  providers: [WorksService],
  exports: [WorksService],
})
export class WorksModule {}
