import { db } from "./index.ts";
import { sql } from "drizzle-orm";

export async function resolveMarketRegeneration(planetId: string) {
    await db.execute(sql`
        UPDATE planet_market
        SET 
            stock = CASE
                WHEN stock < base_stock THEN 
                    LEAST(
                        base_stock, 
                        stock + ROUND((ROUND(base_stock / 24.0) * EXTRACT(EPOCH FROM (now() - updated_at)) / 3600)::numeric)::integer
                    )
                WHEN stock > base_stock THEN 
                    GREATEST(
                        base_stock, 
                        stock - ROUND((ROUND(base_stock / 24.0) * EXTRACT(EPOCH FROM (now() - updated_at)) / 3600)::numeric)::integer
                    )
                ELSE stock
            END,
            updated_at = now()
        WHERE planet_id = ${planetId} AND stock != base_stock
    `);
}