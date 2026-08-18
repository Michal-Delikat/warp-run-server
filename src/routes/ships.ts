import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db/index.ts";
import { ships, planets, starSystems } from "../db/schema.ts";
import { requireAuth } from "../middleware/auth.ts"; 
import { resolveArrivedShips } from "../db/resolveArrivals.ts";

interface StarSystem {
  orbitalDistance: number;
  orbitalAngle: number;
}

interface Planet {
  id: string;
  orbitalAngle: number;
  orbitalDistance: number;
}

function getSystemGlobalPosition(system: StarSystem) {
  const angleRad = (system.orbitalAngle * Math.PI) / 180;
  return {
    x: system.orbitalDistance * Math.cos(angleRad),
    y: system.orbitalDistance * Math.sin(angleRad),
  };
}

function getPlanetGlobalPosition(planet: Planet, system: StarSystem) {
  const systemPos = getSystemGlobalPosition(system);

  const planetAngleRad = (planet.orbitalAngle * Math.PI) / 180;
  return {
    x: systemPos.x + planet.orbitalDistance * Math.cos(planetAngleRad),
    y: systemPos.y + planet.orbitalDistance * Math.sin(planetAngleRad),
  };
}

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

router.post<{ id: string }>("/ships/:id/travel", requireAuth, async (req, res) => {
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
    const [destinationPlanet] = await db.select().from(planets).where(eq(planets.id, destinationPlanetId!));
    
    if (!destinationPlanet) {
      return res.status(404).json({ error: "Destitation planet does not exist"});
    }
    
    const [currentStarSystem] = await db.select().from(starSystems).where(eq(starSystems.id, currentPlanet.starSystemId));
    const [destinationStarSystem] = await db.select().from(starSystems).where(eq(starSystems.id, destinationPlanet.starSystemId));

    const { x: x_current, y: y_current } = getPlanetGlobalPosition(currentPlanet, currentStarSystem);
    const { x: x_destination, y: y_destination } = getPlanetGlobalPosition(destinationPlanet, destinationStarSystem);

    const distance = Math.sqrt(
      Math.pow(x_current - x_destination, 2) +
      Math.pow(y_current - y_destination, 2)
    );

    const SUBLIGHT_SPEED = 10000;

    const travelSeconds = distance / SUBLIGHT_SPEED;

    const now = new Date();
    const arrivalAt = new Date(now.getTime() + travelSeconds * 1000);

    const [updatedShip] = await db
      .update(ships)
      .set({
        currentPlanetId: null,
        departurePlanetId: currentPlanet.id,
        destinationPlanetId: destinationPlanet.id,
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

router.post<{ id: string }>("/ships/:id/jump", requireAuth, async (req, res) => {
  const shipId = req.params.id;

  try {
    const [ship] = await db.select().from(ships).where(eq(ships.id, shipId));

    if (!ship) {
      return res.status(404).json({ error: "Ship not found" });
    }

    if (ship.currentPlanetId) {
      return res.status(409).json({ error: "Ship is not in transit" });
    }

    if (!ship.destinationPlanetId) {
      return res.status(409).json({ error: "Ship destination is unknown" });
    }

    await db
      .update(ships)
      .set({
        currentPlanetId: ship.destinationPlanetId,
        departurePlanetId: null,
        destinationPlanetId: null,
        departedAt: null,
        arrivalAt: null
      });

    res.json({
      currentPlanetId: ship.destinationPlanetId
    });
  } catch(error) {
    console.error(error);
    res.status(500).json({ error: "Jump was unsuccesfull"});
  }
});

export default router;