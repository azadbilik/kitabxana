import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AuthorsModule } from './authors/authors.module';
import { CollectionsModule } from './collections/collections.module';
import { WorksModule } from './works/works.module';
import { TranslationsModule } from './translations/translations.module';
import { SubmissionsModule } from './submissions/submissions.module';
import { SearchModule } from './search/search.module';
import { BlogModule } from './blog/blog.module';
import { SitemapModule } from './sitemap/sitemap.module';
import { TagsModule } from './tags/tags.module';
import { DownloadsModule } from './downloads/downloads.module';
import { AccountModule } from './account/account.module';
import { LibraryModule } from './library/library.module';
import { TelegramModule } from './telegram/telegram.module';
import { validateEnv } from './common/env';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { HealthController } from './common/health.controller';
import { CleanupService } from './common/services/cleanup.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    // Limits apply only where ClientIpThrottlerGuard is used; routes set their own via @Throttle
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    PrismaModule,
    AuthModule,
    UsersModule,
    AuthorsModule,
    CollectionsModule,
    WorksModule,
    TagsModule,
    TranslationsModule,
    SubmissionsModule,
    SearchModule,
    BlogModule,
    SitemapModule,
    DownloadsModule,
    AccountModule,
    LibraryModule,
    TelegramModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_FILTER, useClass: PrismaExceptionFilter }, CleanupService],
})
export class AppModule {}
