import { pgTable, text, serial, integer, boolean, timestamp, jsonb, primaryKey, index, date, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Users table to store user information
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert schema for users
export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Sessions table to store user sessions
export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});

// Insert schema for sessions
export const insertSessionSchema = createInsertSchema(sessions).omit({ id: true });
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessions.$inferSelect;

// Hand tracking sessions to store tracking data
export const trackingSessions = pgTable("tracking_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  startTime: timestamp("start_time").defaultNow().notNull(),
  endTime: timestamp("end_time"),
  duration: integer("duration"), // duration in seconds
  name: text("name"),
  notes: text("notes"),
});

// Insert schema for tracking sessions
export const insertTrackingSessionSchema = createInsertSchema(trackingSessions).omit({ id: true });
export type InsertTrackingSession = z.infer<typeof insertTrackingSessionSchema>;
export type TrackingSession = typeof trackingSessions.$inferSelect;

// Hand landmarks data to store hand tracking data
export const handLandmarkData = pgTable("hand_landmark_data", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => trackingSessions.id, { onDelete: "cascade" }),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  frameNumber: integer("frame_number").notNull(),
  handLandmarks: jsonb("hand_landmarks").notNull(), // JSON array of hand landmarks
  connections: jsonb("connections"), // JSON array of connections
  performanceMetrics: jsonb("performance_metrics"), // JSON object of performance metrics
  averageFps: real("average_fps"),
});

// Insert schema for hand landmark data
export const insertHandLandmarkDataSchema = createInsertSchema(handLandmarkData).omit({ id: true });
export type InsertHandLandmarkData = z.infer<typeof insertHandLandmarkDataSchema>;
export type HandLandmarkData = typeof handLandmarkData.$inferSelect;

// Regions of interest (ROI) table to store defined regions
export const regionsOfInterest = pgTable("regions_of_interest", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => trackingSessions.id, { onDelete: "cascade" }),
  name: text("name"),
  boundingBox: jsonb("bounding_box").notNull(), // JSON object with x, y, width, height
  createdAt: timestamp("created_at").defaultNow().notNull(),
  active: boolean("active").default(true).notNull(),
});

// Insert schema for regions of interest
export const insertRegionOfInterestSchema = createInsertSchema(regionsOfInterest).omit({ id: true });
export type InsertRegionOfInterest = z.infer<typeof insertRegionOfInterestSchema>;
export type RegionOfInterest = typeof regionsOfInterest.$inferSelect;

// Define relations between tables
export const userRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  trackingSessions: many(trackingSessions),
}));

export const trackingSessionRelations = relations(trackingSessions, ({ one, many }) => ({
  user: one(users, {
    fields: [trackingSessions.userId],
    references: [users.id],
  }),
  handLandmarkData: many(handLandmarkData),
  regionsOfInterest: many(regionsOfInterest),
}));

export const handLandmarkDataRelations = relations(handLandmarkData, ({ one }) => ({
  trackingSession: one(trackingSessions, {
    fields: [handLandmarkData.sessionId],
    references: [trackingSessions.id],
  }),
}));

export const regionsOfInterestRelations = relations(regionsOfInterest, ({ one }) => ({
  trackingSession: one(trackingSessions, {
    fields: [regionsOfInterest.sessionId],
    references: [trackingSessions.id],
  }),
}));
