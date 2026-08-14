import express from "express";
import cors from "cors";
import { eq } from "drizzle-orm";
import { db } from "./db/index.ts";
import { players, ships, planets } from "./db/schema.ts";
import { resolveArrivedShips } from "./db/resolveArrivals.ts";

const app = express();
app.use(express.json());
app.use(cors());
const PORT = process.env.PORT || 3000;

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/players", async (req, res) => {
  const { email, username } = req.body;

  if (!email || !username) {
    return res.status(400).json({ error: 'Username and Email are required'})
  }

  try {
    const newPlayer = await db.transaction(async (tx) => {
      const [player] = await tx
        .insert(players)
        .values({ email, username })
        .returning();

      const [startPlanet] = await tx.select().from(planets).limit(1);

      if (!startPlanet) {
        throw new Error("No planets - cannot create the starship");
      }

      const [ship] = await tx
        .insert(ships)
        .values({
          playerId: player.id,
          name: `${username}'s Ship`,
          currentPlanetId: startPlanet.id,
        })
        .returning();

      return { player, ship };
    });

    res.status(201).json(newPlayer);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Unable to create player" });
  }
});

app.get("/players", async (req, res) => {
  const allPlayers = await db.select().from(players);
  res.json(allPlayers);
});

app.post("/ships/:id/travel", async(req, res) => {
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

    const SUBLIGHT_SPEED = 0.5;

    const travelSeconds = distance / SUBLIGHT_SPEED;

    const now = new Date();
    const arrivalAt = new Date(now.getTime() + travelSeconds * 1000);

    const [updatedShip] = await db
      .update(ships)
      .set({
        currentPlanetId: null,
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
    })
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: "Travel was unsuccesfull"});
  }
});

app.get("/ships/:id", async (req, res) => {
  await resolveArrivedShips();
  const [ship] = await db.select().from(ships).where(eq(ships.id, req.params.id));
  res.json(ship);
});

app.listen(PORT, () => {
  console.log(`WarpRun server running on port ${PORT}`);
});