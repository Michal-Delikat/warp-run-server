import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db/index.ts";
import { ships, planets } from "../db/schema.ts";
import { requireAuth } from "../middleware/auth.ts"; 
import { resolveArrivedShips } from "../db/resolveArrivals.ts";

const router = Router();

router.get("/me/ships", requireAuth, async (req, res) => {
  await resolveArrivedShips();

  const playerShips = await db.query.ships.findMany({
    where: eq(ships.playerId, req.playerId!),
    with: {
      currentPlanet:              { columns: { id: true, name: true } },
      departurePlanet:            { columns: { id: true, name: true } },
      destinationPlanet:          { columns: { id: true, name: true } },
      cargo: { with: { resource:  { columns: { id: true, name: true } } } },
    },
  });

  res.json(playerShips);
});

router.post<{ id: string }>("/ships/:id/travel", requireAuth, async(req, res) => {
  const shipId = req.params.id;
  const { destinationPlanetId } = req.body;

  if (!destinationPlanetId) {
    return res.status(400).json({ error: "destiationPlanetId is required" });
  }

  try {
    const [ship] = await db.select().from(ships).where(eq(ships.id, shipId));

    if (!ship) {
      return res.status(404).json({ error: "Ship does not exists" });
    }

    if (ship.playerId !== req.playerId) {
      return res.status(403).json({ error: "This ship does not belong to you" });
    }

    if (!ship.currentPlanetId) {
      return res.status(409).json({ error: "Ship is already travelling "});
    }
    
    const [currentPlanet] = await db.select().from(planets).where(eq(planets.id, ship.currentPlanetId));
    const [destPlanet] = await db.select().from(planets).where(eq(planets.id, destinationPlanetId));

    if (!destPlanet) {
      return res.status(404).json({ error: "Destitation planet does not exist"});
    }

    const distance = Math.sqrt(
      Math.pow(destPlanet.positionX - currentPlanet.positionX, 2) +
      Math.pow(destPlanet.positionY - currentPlanet.positionY, 2)
    );

    const SUBLIGHT_SPEED = 6;

    const travelSeconds = distance / SUBLIGHT_SPEED;

    const now = new Date();
    const arrivalAt = new Date(now.getTime() + travelSeconds * 1000);

    const [updatedShip] = await db
      .update(ships)
      .set({
        currentPlanetId: null,
        departurePlanetId: currentPlanet.id,
        destinationPlanetId: destPlanet.id,
        departedAt: now,
        arrivalAt,
      })
      .where(eq(ships.id, shipId))
      .returning();
    
    res.json({
      ship: updatedShip,
      distance,
      travelSeconds,
    });
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: "Travel was unsuccesfull"});
  }
});

export default router;