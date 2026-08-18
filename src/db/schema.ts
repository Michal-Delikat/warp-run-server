import { pgTable, uuid, varchar, integer, timestamp, unique, type AnyPgColumn } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/* Tables */

export const players = pgTable("players", {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    username: varchar("username", { length: 50 }).notNull().unique(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    cash: integer("cash").default(3000)
});

export const ships = pgTable("ships", {
    id: uuid("id").primaryKey().defaultRandom(),
    playerId: uuid("player_id").notNull().references(() => players.id),
    name: varchar("name", { length: 100 }).notNull(),

    currentPlanetId: uuid("current_planet_id").references(() => planets.id),
    departurePlanetId: uuid("departure_planet_id").references(() => planets.id),
    destinationPlanetId: uuid("destination_planet_id").references(() => planets.id),
    departedAt: timestamp("departed_at"),
    arrivalAt: timestamp("arrival_at"),

    fuel: integer("fuel").notNull().default(100),
    cargoCapacity: integer("cargo_capacity").notNull().default(5),

    createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const resources = pgTable("resources", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 100 }).notNull().unique(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const shipCargo = pgTable("ship_cargo", {
    id: uuid("id").primaryKey().defaultRandom(),
    shipId: uuid("ship_id").notNull().references(() => ships.id, { onDelete: "cascade" }),
    resourceId: uuid("resource_id").notNull().references(() => resources.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull().default(0),
}, (table) => ({
    uniqueShipResource: unique().on(table.shipId, table.resourceId),
}));

export const planetMarket= pgTable("planet_market", {
    id: uuid("id").primaryKey().defaultRandom(),
    planetId: uuid("planet_id").notNull().references(() => planets.id, { onDelete: "cascade" }),
    resourceId: uuid("resource_id").notNull().references(() => resources.id, { onDelete: "cascade" }),
    price: integer("price").notNull(),
    stock: integer("stock").notNull(),
    baseStock: integer("base_stock").notNull(),
}, (table) => ({
    uniquePlanetResource: unique().on(table.planetId, table.resourceId),
}));

export const starSystems = pgTable("star_systems", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 100 }).notNull().unique(),
    orbitalDistance: integer("orbital_distance").notNull(),
    orbitalAngle: integer("orbital_angle").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow()
});

export const planets = pgTable("planets", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 100 }). notNull().unique(),
    starSystemId: uuid("star_system_id").notNull().references(() => starSystems.id, { onDelete: "cascade" }),
    orbitalParentId: uuid("orbital_parent_id").references((): AnyPgColumn => planets.id),
    orbitalDistance: integer("orbital_distance").notNull(),
    orbitalAngle: integer("orbital_angle").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
});

/* Relations */

export const shipsRelations = relations(ships, ({ one, many }) => ({
  player: one(players, { fields: [ships.playerId], references: [players.id] }),
  currentPlanet: one(planets, { fields: [ships.currentPlanetId], references: [planets.id] }),
  departurePlanet: one(planets, { fields: [ships.departurePlanetId], references: [planets.id] }),
  destinationPlanet: one(planets, { fields: [ships.destinationPlanetId], references: [planets.id] }),
  cargo: many(shipCargo),
}));

export const shipCargoRelations = relations(shipCargo, ({ one }) => ({
    ship: one(ships, { fields: [shipCargo.shipId], references: [ships.id]}),
    resource: one(resources, { fields: [shipCargo.resourceId], references: [resources.id] }),
}));

export const planetMarketRelations = relations(planetMarket, ({ one }) => ({
  planet: one(planets, { fields: [planetMarket.planetId], references: [planets.id] }),
  resource: one(resources, { fields: [planetMarket.resourceId], references: [resources.id] }),
}));

export const planetsRelations = relations(planets, ({ one, many }) => ({
    starSystem: one(starSystems, { fields: [planets.starSystemId], references: [starSystems.id] }),
    market: many(planetMarket),
}));