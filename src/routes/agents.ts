    import { Router } from "express";
    import { eq } from "drizzle-orm";
    import { db } from "../db/index.ts";
    import { agents } from "../db/schema.ts";
    import { requireAuth } from "../middleware/auth.ts";

    const router = Router();

    router.get("/me/agents", requireAuth, async (req, res) => {
        const playerAgents = await db.query.agents.findMany({
            where: eq(agents.playerId, req.playerId!),
            with: {
                planet: { columns: { id: true, name: true }},
            },
        });

        res.json(playerAgents);
    });

    export default router;