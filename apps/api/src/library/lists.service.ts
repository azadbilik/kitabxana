import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { bookSelect, toBook, workSelect, type Book, type WorkRow } from './selects';

const MAX_LISTS = 50;
const MAX_ITEMS = 1000;

export type ListTarget = { workId: string } | { collectionId: string };

type ListItem = { id: string; type: 'book'; book: Book } | { id: string; type: 'work'; work: WorkRow };

/** Reader-made lists of books and works. Private: only their owner can read them. */
@Injectable()
export class ListsService {
  constructor(private prisma: PrismaService) {}

  private async own(userId: string, listId: string) {
    const list = await this.prisma.readingList.findFirst({ where: { id: listId, userId } });
    if (!list) throw new NotFoundException();
    return list;
  }

  async all(userId: string) {
    const lists = await this.prisma.readingList.findMany({
      where: { userId },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        name: true,
        updatedAt: true,
        _count: { select: { items: true } },
        // The first few books, for the covers on the overview
        items: {
          where: { collectionId: { not: null } },
          orderBy: { order: 'asc' },
          take: 3,
          select: { collection: { select: { id: true, titleAz: true, titleRu: true, titleEn: true, genre: true, author: { select: { slug: true, nameAz: true, nameRu: true, nameEn: true } } } } },
        },
      },
    });
    return lists.map(({ _count, items, ...l }) => ({ ...l, count: _count.items, covers: items.map((i) => i.collection!) }));
  }

  async create(userId: string, name: string) {
    const clean = name.trim().slice(0, 80);
    if (!clean) throw new BadRequestException('A list needs a name');
    if ((await this.prisma.readingList.count({ where: { userId } })) >= MAX_LISTS) {
      throw new BadRequestException(`At most ${MAX_LISTS} lists`);
    }
    const last = await this.prisma.readingList.findFirst({ where: { userId }, orderBy: { order: 'desc' }, select: { order: true } });
    return this.prisma.readingList.create({
      data: { userId, name: clean, order: (last?.order ?? -1) + 1 },
      select: { id: true, name: true },
    });
  }

  async rename(userId: string, listId: string, name: string) {
    await this.own(userId, listId);
    const clean = name.trim().slice(0, 80);
    if (!clean) throw new BadRequestException('A list needs a name');
    return this.prisma.readingList.update({ where: { id: listId }, data: { name: clean }, select: { id: true, name: true } });
  }

  async remove(userId: string, listId: string) {
    await this.own(userId, listId);
    await this.prisma.readingList.delete({ where: { id: listId } });
  }

  async one(userId: string, listId: string) {
    const list = await this.own(userId, listId);
    const items = await this.prisma.readingListItem.findMany({
      where: { listId },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, work: { select: workSelect }, collection: { select: bookSelect } },
    });
    return {
      id: list.id,
      name: list.name,
      items: items.flatMap((i): ListItem[] => {
        if (i.collection) return [{ id: i.id, type: 'book', book: toBook(i.collection) }];
        return i.work ? [{ id: i.id, type: 'work', work: i.work }] : [];
      }),
    };
  }

  /** Which of the reader's lists hold this work or book, for the "add to list" popover */
  async containing(userId: string, target: ListTarget) {
    const items = await this.prisma.readingListItem.findMany({
      where: { list: { userId }, ...target },
      select: { listId: true },
    });
    return items.map((i) => i.listId);
  }

  async add(userId: string, listId: string, target: ListTarget) {
    await this.own(userId, listId);
    const exists =
      'workId' in target
        ? await this.prisma.work.findFirst({ where: { id: target.workId, status: 'PUBLISHED' }, select: { id: true } })
        : await this.prisma.collection.findFirst({ where: { id: target.collectionId, status: 'PUBLISHED' }, select: { id: true } });
    if (!exists) throw new NotFoundException();
    const count = await this.prisma.readingListItem.count({ where: { listId } });
    if (count >= MAX_ITEMS) throw new BadRequestException(`At most ${MAX_ITEMS} items in a list`);
    const already = await this.prisma.readingListItem.findFirst({ where: { listId, ...target }, select: { id: true } });
    if (already) return already;
    const item = await this.prisma.readingListItem.create({ data: { listId, ...target, order: count }, select: { id: true } });
    await this.prisma.readingList.update({ where: { id: listId }, data: { updatedAt: new Date() } });
    return item;
  }

  async removeTarget(userId: string, listId: string, target: ListTarget) {
    await this.own(userId, listId);
    await this.prisma.readingListItem.deleteMany({ where: { listId, ...target } });
  }

  async removeItem(userId: string, listId: string, itemId: string) {
    await this.own(userId, listId);
    await this.prisma.readingListItem.deleteMany({ where: { id: itemId, listId } });
  }
}
