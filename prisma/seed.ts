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
})();
