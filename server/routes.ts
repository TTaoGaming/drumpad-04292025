import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertTrackingSessionSchema, 
  insertHandLandmarkDataSchema,
  insertRegionOfInterestSchema
} from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  /**
   * User routes - simplified for demo purposes
   * In a production app, would include proper authentication
   */
  app.post("/api/users", async (req: Request, res: Response) => {
    try {
      // In a real app, would validate and hash password here
      const fakeUser = {
        username: "demo_user",
        email: "demo@example.com",
        passwordHash: "dummy_hashed_password"
      };
      
      const user = await storage.createUser(fakeUser);
      res.status(201).json(user);
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  /**
   * Tracking Session routes
   */
  app.post("/api/tracking-sessions", async (req: Request, res: Response) => {
    try {
      const result = insertTrackingSessionSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      
      const session = await storage.createTrackingSession(result.data);
      res.status(201).json(session);
    } catch (error) {
      console.error("Error creating tracking session:", error);
      res.status(500).json({ error: "Failed to create tracking session" });
    }
  });

  app.get("/api/tracking-sessions/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid session ID" });
      }
      
      const session = await storage.getTrackingSession(id);
      if (!session) {
        return res.status(404).json({ error: "Tracking session not found" });
      }
      
      res.json(session);
    } catch (error) {
      console.error("Error retrieving tracking session:", error);
      res.status(500).json({ error: "Failed to retrieve tracking session" });
    }
  });

  app.get("/api/users/:userId/tracking-sessions", async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) {
        return res.status(400).json({ error: "Invalid user ID" });
      }
      
      const sessions = await storage.getTrackingSessionsByUserId(userId);
      res.json(sessions);
    } catch (error) {
      console.error("Error retrieving user tracking sessions:", error);
      res.status(500).json({ error: "Failed to retrieve user tracking sessions" });
    }
  });

  app.patch("/api/tracking-sessions/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid session ID" });
      }
      
      // Only validate the provided fields
      const partialSchema = z.object({
        endTime: z.date().optional(),
        duration: z.number().optional(),
        name: z.string().optional(),
        notes: z.string().optional()
      });
      
      const result = partialSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      
      const updatedSession = await storage.updateTrackingSession(id, result.data);
      if (!updatedSession) {
        return res.status(404).json({ error: "Tracking session not found" });
      }
      
      res.json(updatedSession);
    } catch (error) {
      console.error("Error updating tracking session:", error);
      res.status(500).json({ error: "Failed to update tracking session" });
    }
  });

  /**
   * Hand Landmark Data routes
   */
  app.post("/api/hand-landmark-data", async (req: Request, res: Response) => {
    try {
      const result = insertHandLandmarkDataSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      
      const landmarkData = await storage.saveHandLandmarkData(result.data);
      res.status(201).json(landmarkData);
    } catch (error) {
      console.error("Error saving hand landmark data:", error);
      res.status(500).json({ error: "Failed to save hand landmark data" });
    }
  });

  app.get("/api/tracking-sessions/:sessionId/landmark-data", async (req: Request, res: Response) => {
    try {
      const sessionId = parseInt(req.params.sessionId);
      if (isNaN(sessionId)) {
        return res.status(400).json({ error: "Invalid session ID" });
      }
      
      const landmarkData = await storage.getHandLandmarkDataBySessionId(sessionId);
      res.json(landmarkData);
    } catch (error) {
      console.error("Error retrieving hand landmark data:", error);
      res.status(500).json({ error: "Failed to retrieve hand landmark data" });
    }
  });

  /**
   * Region of Interest routes
   */
  app.post("/api/regions-of-interest", async (req: Request, res: Response) => {
    try {
      const result = insertRegionOfInterestSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      
      const roi = await storage.createRegionOfInterest(result.data);
      res.status(201).json(roi);
    } catch (error) {
      console.error("Error creating region of interest:", error);
      res.status(500).json({ error: "Failed to create region of interest" });
    }
  });

  app.get("/api/tracking-sessions/:sessionId/regions-of-interest", async (req: Request, res: Response) => {
    try {
      const sessionId = parseInt(req.params.sessionId);
      if (isNaN(sessionId)) {
        return res.status(400).json({ error: "Invalid session ID" });
      }
      
      const regions = await storage.getRegionOfInterestsBySessionId(sessionId);
      res.json(regions);
    } catch (error) {
      console.error("Error retrieving regions of interest:", error);
      res.status(500).json({ error: "Failed to retrieve regions of interest" });
    }
  });

  app.patch("/api/regions-of-interest/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid region ID" });
      }
      
      // Only validate the provided fields
      const partialSchema = z.object({
        name: z.string().optional(),
        boundingBox: z.any().optional(),
        active: z.boolean().optional()
      });
      
      const result = partialSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      
      const updatedRegion = await storage.updateRegionOfInterest(id, result.data);
      if (!updatedRegion) {
        return res.status(404).json({ error: "Region of interest not found" });
      }
      
      res.json(updatedRegion);
    } catch (error) {
      console.error("Error updating region of interest:", error);
      res.status(500).json({ error: "Failed to update region of interest" });
    }
  });

  // Health check endpoint
  app.get("/api/health", (req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

  return httpServer;
}
