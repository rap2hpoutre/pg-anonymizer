-- CreateTable
CREATE TABLE "user" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "empty" TEXT,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);
