import { 
  users, 
  trackingSessions, 
  handLandmarkData,
  regionsOfInterest,
  type User, 
  type InsertUser,
  type TrackingSession,
  type InsertTrackingSession,
  type HandLandmarkData,
  type InsertHandLandmarkData,
  type RegionOfInterest,
  type InsertRegionOfInterest
} from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Tracking session operations
  createTrackingSession(session: InsertTrackingSession): Promise<TrackingSession>;
  getTrackingSession(id: number): Promise<TrackingSession | undefined>;
  getTrackingSessionsByUserId(userId: number): Promise<TrackingSession[]>;
  updateTrackingSession(id: number, data: Partial<InsertTrackingSession>): Promise<TrackingSession | undefined>;
  
  // Hand landmark data operations
  saveHandLandmarkData(data: InsertHandLandmarkData): Promise<HandLandmarkData>;
  getHandLandmarkDataBySessionId(sessionId: number): Promise<HandLandmarkData[]>;
  
  // Region of interest operations
  createRegionOfInterest(roi: InsertRegionOfInterest): Promise<RegionOfInterest>;
  getRegionOfInterestsBySessionId(sessionId: number): Promise<RegionOfInterest[]>;
  updateRegionOfInterest(id: number, data: Partial<InsertRegionOfInterest>): Promise<RegionOfInterest | undefined>;
}

// Database storage implementation using Drizzle ORM
export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }
  
  // Tracking session operations
  async createTrackingSession(session: InsertTrackingSession): Promise<TrackingSession> {
    const [newSession] = await db
      .insert(trackingSessions)
      .values(session)
      .returning();
    return newSession;
  }
  
  async getTrackingSession(id: number): Promise<TrackingSession | undefined> {
    const [session] = await db
      .select()
      .from(trackingSessions)
      .where(eq(trackingSessions.id, id));
    return session || undefined;
  }
  
  async getTrackingSessionsByUserId(userId: number): Promise<TrackingSession[]> {
    return await db
      .select()
      .from(trackingSessions)
      .where(eq(trackingSessions.userId, userId));
  }
  
  async updateTrackingSession(id: number, data: Partial<InsertTrackingSession>): Promise<TrackingSession | undefined> {
    const [updatedSession] = await db
      .update(trackingSessions)
      .set(data)
      .where(eq(trackingSessions.id, id))
      .returning();
    return updatedSession || undefined;
  }
  
  // Hand landmark data operations
  async saveHandLandmarkData(data: InsertHandLandmarkData): Promise<HandLandmarkData> {
    const [savedData] = await db
      .insert(handLandmarkData)
      .values(data)
      .returning();
    return savedData;
  }
  
  async getHandLandmarkDataBySessionId(sessionId: number): Promise<HandLandmarkData[]> {
    return await db
      .select()
      .from(handLandmarkData)
      .where(eq(handLandmarkData.sessionId, sessionId));
  }
  
  // Region of interest operations
  async createRegionOfInterest(roi: InsertRegionOfInterest): Promise<RegionOfInterest> {
    const [newRoi] = await db
      .insert(regionsOfInterest)
      .values(roi)
      .returning();
    return newRoi;
  }
  
  async getRegionOfInterestsBySessionId(sessionId: number): Promise<RegionOfInterest[]> {
    return await db
      .select()
      .from(regionsOfInterest)
      .where(eq(regionsOfInterest.sessionId, sessionId));
  }
  
  async updateRegionOfInterest(id: number, data: Partial<InsertRegionOfInterest>): Promise<RegionOfInterest | undefined> {
    const [updatedRoi] = await db
      .update(regionsOfInterest)
      .set(data)
      .where(eq(regionsOfInterest.id, id))
      .returning();
    return updatedRoi || undefined;
  }
}

// Export a singleton instance of the database storage
export const storage = new DatabaseStorage();
