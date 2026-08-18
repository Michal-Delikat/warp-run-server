import { Router } from "express";
import { eq, ne, and, sql } from "drizzle-orm";
import { db } from "../db/index.ts";
import { planets, planetMarket, ships, shipCargo, players } from "../db/schema.ts";
import { requireAuth } from "../middleware/auth.ts";

const router = Router();

router.get<{ id: string }>("/planets/:id/neighbors", requireAuth, async (req, res) => {
    const planetId = req.params.id;

    try {
        const [planet] = await db.select().from(planets).where(eq(planets.id, planetId));

        if (!planet) {
            return res.status(404).json({ error: "Planet does not exist"});
        }

        const otherPlanets = await db.select().from(planets).where(ne(planets.id, planetId));

        res.json(otherPlanets);
    } catch(err) {
        console.error(err);
        res.status(500).json({ error: "Planets neighbors not found"})
    }
});

router.get<{ id: string }>("/planets/:id/market", requireAuth, async (req, res) => {
    const planetId = req.params.id
    const planetMarketData = await db.query.planetMarket.findMany({
        where: eq(planetMarket.planetId, planetId),
        with: { 
            resource: { 
                columns: { 
                    id: true, 
                    name: true 
                } 
            }, 
        },
        columns: { id: true, price: true, stock: true },
    });

    res.json(planetMarketData);
});

router.post<{ id: string }>("/planets/:id/market/buy", requireAuth, async (req, res) => {
    const planetId = req.params.id;
    const { resourceId, quantity, shipId } = req.body;

    if (!resourceId  || !quantity || !shipId) {
        return res.status(400).json({ error: "resourceId, quantity and shipId is required" });
    }

    try {
        const result = await db.transaction(async (tx) => {
            const [ship] = await tx.select().from(ships).where(eq(ships.id, shipId));

            if (!ship || ship.playerId !== req.playerId) {
                throw { status: 403, message: "This ship does not belong to you" };
            }
            if (ship.currentPlanetId !== planetId) {
                throw { status: 409, message: "Ship is not on this planet" };
            }

            const [market] = await tx
                .select()
                .from(planetMarket)
                .where(and(eq(planetMarket.planetId, planetId), eq(planetMarket.resourceId, resourceId)));

            if (!market || market.stock < quantity) {
                throw { status: 409, message: "Not enought resource on the planet" };
            }

            const newStock = market.stock - quantity;
            const priceChangeFactor = 1 + (quantity / Math.max(newStock, 1));
            const newPrice = Math.max(1, Math.ceil(market.price * priceChangeFactor));
            const totalCost = quantity * market.price;

            const [player] = await tx
                .select()
                .from(players)
                .where(eq(players.id, req.playerId));

            if (player.cash! < totalCost) {
                throw { status: 409, message: "Not enough cash" };
            }

            const [cargoUsage] = await tx
                .select({ total: sql<number>`coalesce(sum(${shipCargo.quantity}), 0)` })
                .from(shipCargo)
                .where(eq(shipCargo.shipId, shipId));

            const usedCapacity = Number(cargoUsage.total);

            if (usedCapacity + quantity > ship.cargoCapacity) {
                throw {
                    status: 409,
                    message: "Not enough cargo space"
                }
            }

            await tx
                .update(planetMarket)
                .set({ stock: newStock, price: newPrice })
                .where(eq(planetMarket.id, market.id));

            await tx
                .update(players)
                .set({ cash: player.cash! - totalCost })
                .where(eq(players.id, player.id));

            const [existingCargo] = await tx
                .select()
                .from(shipCargo)
                .where(and(eq(shipCargo.shipId, shipId), eq(shipCargo.resourceId, resourceId)));

            if (existingCargo) {
                await tx
                    .update(shipCargo)
                    .set({ quantity: existingCargo.quantity + quantity })
                    .where(eq(shipCargo.id, existingCargo.id));
            } else {
                await tx.insert(shipCargo).values({ shipId, resourceId, quantity });
            }

            return { totalCost, newPrice, newStock };
        });

        res.json(result);
    } catch (error: any) {
        console.error(error);
        if (error.status) {
            return res.status(error.status).json({ error: error.message });
        }
        res.status(500).json({ error: "Purchase was unsuccesful"});
    }
});

router.post<{ id: string}>("/planets/:id/market/sell", requireAuth, async (req, res) => {
    const planetId = req.params.id;
    const { resourceId, quantity, shipId } = req.body;

    if (!resourceId  || !quantity || !shipId) {
        return res.status(400).json({ error: "resourceId, quantity and shipId is required" });
    }

    try {
        const result = await db.transaction(async (tx) => {
            const [ship] = await tx.select().from(ships).where(eq(ships.id, shipId));

            if (!ship || ship.playerId !== req.playerId) {
                throw { status: 403, message: "This ship does not belong to you" };
            }
            if (ship.currentPlanetId !== planetId) {
                throw { status: 409, message: "Ship is not on this planet" };
            }

            const [existingCargo] = await tx
                .select()
                .from(shipCargo)
                .where(and(eq(shipCargo.shipId, shipId), eq(shipCargo.resourceId, resourceId)));

            if (!existingCargo || existingCargo.quantity < quantity) {
                throw { status: 409, message: "You don't have enough resource"}
            }

            const [market] = await tx
                .select()
                .from(planetMarket)
                .where(and(eq(planetMarket.planetId, planetId), eq(planetMarket.resourceId, resourceId)));

            const newStock = market.stock + quantity;
            const priceDecreaseFactor = 1 - (quantity / newStock);
            const newPrice = Math.max(1, Math.floor(market.price * priceDecreaseFactor));
            const totalCost = market.price * quantity;

            const [player] = await tx
                .select()
                .from(players)
                .where(eq(players.id, req.playerId));

            await tx
                .update(planetMarket)
                .set({ stock: newStock, price: newPrice })
                .where(eq(planetMarket.id, market.id));

            await tx
                .update(players)
                .set({ cash: player.cash! + totalCost })
                .where(eq(players.id, player.id));

            if (existingCargo.quantity - quantity > 0) {
                await tx
                    .update(shipCargo)
                    .set({ quantity: existingCargo.quantity - quantity })
                    .where(eq(shipCargo.id, existingCargo.id));
            } else {
                await tx
                    .delete(shipCargo)
                    .where(eq(shipCargo.id, existingCargo.id));
            }

            return {totalCost, newPrice, newStock };
        });

        res.json(result);
    } catch (error: any) {
        console.error(error);
        if (error.status) {
            return res.status(error.status).json({ error: error.message });
        }
        res.status(500).json({ error: "Sell was unsuccesful"});
    }
})


export default router;