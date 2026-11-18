import { Module } from '@nestjs/common';
import { WorksModule } from '../works/works.module';
import { TelegramService } from './telegram.service';

/** Optional: the poem of the day posted to a Telegram channel */
@Module({
  imports: [WorksModule],
  providers: [TelegramService],
})
export class TelegramModule {}
