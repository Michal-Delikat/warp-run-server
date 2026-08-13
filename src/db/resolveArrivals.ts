import { db } from "./index.ts";
import { ships } from "./schema.ts";
import { and, isNotNull, lte, sql } from "drizzle-orm";

export async function resolveArrivedShips() {
    const now = new Date();

    await db
        .update(ships)
        .set({
            currentPlanetId: sql`${ships.destinationPlanetId}`,
            destinationPlanetId: null,
            departedAt: null,
            arrivalAt: null
        })
        .where(and(isNotNull(ships.arrivalAt), lte(ships.arrivalAt, now)));
}