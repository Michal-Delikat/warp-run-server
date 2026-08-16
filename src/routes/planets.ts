import { Router } from "express";
import { eq, ne } from "drizzle-orm";
import { db } from "../db/index.ts";
import { planets } from "../db/schema.ts";
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

export default router;