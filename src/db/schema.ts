import { pgTable, uuid, varchar, integer, timestamp } from "drizzle-orm/pg-core";

export const players = pgTable("players", {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    username: varchar("username", { length: 50 }).notNull().unique(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const planets = pgTable("planets", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 100 }). notNull().unique(),
    positionX: integer("position_x").notNull(),
    positionY: integer("position_y").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const ships = pgTable("ships", {
    id: uuid("id").primaryKey().defaultRandom(),
    playerId: uuid("player_id").notNull().references(() => players.id),
    name: varchar("name", { length: 100 }).notNull(),

    currentPlanetId: uuid("current_planet_id").references(() => planets.id),
    destinationPlanetId: uuid("destination_planet_id").references(() => planets.id),
    departedAt: timestamp("departed_at"),
    arrivalAt: timestamp("arrival_at"),

    fuel: integer("fuel").notNull().default(100),
    cargoCapacity: integer("cargo_capacity").notNull().default(50),

    createdAt: timestamp("created_at").notNull().defaultNow(),
});