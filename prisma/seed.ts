import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

(async () => {
  await prisma.user.upsert({
    create: {
      id: 1,
      name: "Bob",
      password: "cats",
    },
    update: {
      name: "Bob",
      password: "cats",
    },
    where: {
      id: 1,
    },
  });

  await prisma.post.upsert({
    create: {
      id: 1,
      title: "Post 1",
      userId: 1,
    },
    update: {
      title: "Post 1",
      userId: 1,
    },
    where: {
      id: 1,
    },
  });

  await prisma.post.upsert({
    create: {
      id: 2,
      title: "Post 2",
      userId: 1,
    },
    update: {
      title: "Post 2",
      userId: 1,
    },
    where: {
      id: 2,
    },
  });
})();
