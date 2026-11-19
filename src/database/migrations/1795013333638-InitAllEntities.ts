import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitAllEntities1795013333638 implements MigrationInterface {
  name = 'InitAllEntities1795013333638';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."users_role_enum" AS ENUM('ADMIN', 'STAFF', 'CUSTOMER')`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "fullName" character varying NOT NULL, "passwordHash" character varying NOT NULL, "role" "public"."users_role_enum" NOT NULL DEFAULT 'CUSTOMER', "imageUrl" character varying, "imageFile" character varying, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "staff" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "specialization" character varying NOT NULL, "isActive" boolean NOT NULL DEFAULT true, CONSTRAINT "UQ_eba76c23bcfc9dad2479b7fd2ad" UNIQUE ("userId"), CONSTRAINT "REL_eba76c23bcfc9dad2479b7fd2a" UNIQUE ("userId"), CONSTRAINT "PK_e4ee98bb552756c180aec1e854a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."bookings_status_enum" AS ENUM('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "bookings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "customerId" uuid NOT NULL, "staffId" uuid NOT NULL, "serviceId" uuid NOT NULL, "startTime" TIMESTAMP WITH TIME ZONE NOT NULL, "endTime" TIMESTAMP WITH TIME ZONE NOT NULL, "status" "public"."bookings_status_enum" NOT NULL DEFAULT 'PENDING', "notes" character varying(500), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_bee6805982cc1e248e94ce94957" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "services" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(100) NOT NULL, "description" character varying, "durationMinutes" integer NOT NULL, "price" numeric NOT NULL, "imageUrl" character varying, "imageFile" character varying, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_019d74f7abcdcb5a0113010cb03" UNIQUE ("name"), CONSTRAINT "PK_ba2d347a3168a296416c6c5ccb2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff" ADD CONSTRAINT "FK_eba76c23bcfc9dad2479b7fd2ad" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD CONSTRAINT "FK_67b9cd20f987fc6dc70f7cd283f" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD CONSTRAINT "FK_c3e05cfa3bde93838eb75565326" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD CONSTRAINT "FK_15a2431ec10d29dcd96c9563b65" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP CONSTRAINT "FK_15a2431ec10d29dcd96c9563b65"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP CONSTRAINT "FK_c3e05cfa3bde93838eb75565326"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP CONSTRAINT "FK_67b9cd20f987fc6dc70f7cd283f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff" DROP CONSTRAINT "FK_eba76c23bcfc9dad2479b7fd2ad"`,
    );
    await queryRunner.query(`DROP TABLE "services"`);
    await queryRunner.query(`DROP TABLE "bookings"`);
    await queryRunner.query(`DROP TYPE "public"."bookings_status_enum"`);
    await queryRunner.query(`DROP TABLE "staff"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
  }
}
