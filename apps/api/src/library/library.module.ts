import { Module } from '@nestjs/common';
import { AccountModule } from '../account/account.module';
import { LibraryController } from './library.controller';
import { LibraryService } from './library.service';
import { ListsController } from './lists.controller';
import { ListsService } from './lists.service';

/** The reader's library: saved items, read marks, reading positions, the shelf, lists */
@Module({
  imports: [AccountModule],
  controllers: [LibraryController, ListsController],
  providers: [LibraryService, ListsService],
  exports: [LibraryService],
})
export class LibraryModule {}
