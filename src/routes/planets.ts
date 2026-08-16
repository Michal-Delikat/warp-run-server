import { Router } from "express";
import { eq, ne } from "drizzle-orm";
import { db } from "../db/index.ts";
import { planets, planetMarket } from "../db/schema.ts";
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

export default router;