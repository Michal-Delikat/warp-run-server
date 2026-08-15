import { Router } from "express";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { db } from "../db/index.ts";
import { players, ships, planets } from "../db/schema.ts";
import { requireAuth } from "../middleware/auth.ts";

const router = Router();

router.get("/me", requireAuth, async (req, res) => {
    console.log(req.playerId);
  const [player] = await db
    .select({ id: players.id, username: players.username, cash: players.cash })
    .from(players)
    .where(eq(players.id, req.playerId!));

  res.json(player);
});

router.post("/players", async (req, res) => {
  const { email, username, password } = req.body;

  if (!email || !username || !password ) {
    return res.status(400).json({ error: 'Username and Email are required'})
  }

  try {
    const newPlayer = await db.transaction(async (tx) => {
      const passwordHash = await bcrypt.hash(password, 10);

      const [player] = await tx
        .insert(players)
        .values({ email, username, passwordHash })
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

router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "username and password password are required" });
  }

  const [player] = await db.select().from(players).where(eq(players.username, username));

  if (!player) {
    return res.status(401).json({ error: "Wrong username" });
  }

  const passwordMatches = await bcrypt.compare(password, player.passwordHash);

  if (!passwordMatches) {
    return res.status(401).json({ error: "Wrong username or password" });
  }

  const token = jwt.sign(
    { playerId: player.id },
    process.env.JWT_SECRET!,
    { expiresIn: "7d" }
  );

  res.json({ token });
});

export default router;