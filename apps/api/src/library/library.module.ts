import { Module } from '@nestjs/common';
import { AccountModule } from '../account/account.module';
import { LibraryController } from './library.controller';
import { LibraryService } from './library.service';

/** The reader's library: saved items, read marks, reading positions, the shelf */
@Module({
  imports: [AccountModule],
  controllers: [LibraryController],
  providers: [LibraryService],
  exports: [LibraryService],
})
export class LibraryModule {}
