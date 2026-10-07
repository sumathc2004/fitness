import { afterAll } from 'vitest';
import { prisma } from '@gym/database';
import { useOutbox } from '../src/lib/mailer';

useOutbox(); // capture emails instead of sending/logging them

afterAll(async () => {
  await prisma.$disconnect();
});
