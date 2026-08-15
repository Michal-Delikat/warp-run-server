import { pgTable, uuid, varchar, integer, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const players = pgTable("players", {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    username: varchar("username", { length: 50 }).notNull().unique(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    cash: integer("cash").default(3000)
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

export const shipsRelations = relations(ships, ({ one }) => ({
  player: one(players, { fields: [ships.playerId], references: [players.id] }),
  currentPlanet: one(planets, { fields: [ships.currentPlanetId], references: [planets.id] }),
  destinationPlanet: one(planets, { fields: [ships.destinationPlanetId], references: [planets.id] }),
}));