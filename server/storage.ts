import { type User, type InsertUser, type Schedule, type InsertSchedule, type GeneratedPlaylist, type InsertGeneratedPlaylist } from "@shared/schema";
import { randomUUID } from "crypto";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Schedule methods
  getSchedule(id: string): Promise<Schedule | undefined>;
  getSchedulesByUserId(userId: string): Promise<Schedule[]>;
  createSchedule(schedule: InsertSchedule): Promise<Schedule>;
  updateSchedule(id: string, updates: Partial<InsertSchedule>): Promise<Schedule | undefined>;
  deleteSchedule(id: string): Promise<boolean>;
  getActiveSchedules(): Promise<Schedule[]>;
  updateScheduleLastRun(id: string): Promise<void>;

  // Generated playlist methods
  getGeneratedPlaylist(id: string): Promise<GeneratedPlaylist | undefined>;
  getGeneratedPlaylistsByUserId(userId: string): Promise<GeneratedPlaylist[]>;
  createGeneratedPlaylist(playlist: InsertGeneratedPlaylist): Promise<GeneratedPlaylist>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private schedules: Map<string, Schedule>;
  private generatedPlaylists: Map<string, GeneratedPlaylist>;

  constructor() {
    this.users = new Map();
    this.schedules = new Map();
    this.generatedPlaylists = new Map();
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Schedule methods
  async getSchedule(id: string): Promise<Schedule | undefined> {
    return this.schedules.get(id);
  }

  async getSchedulesByUserId(userId: string): Promise<Schedule[]> {
    return Array.from(this.schedules.values()).filter(
      (schedule) => schedule.userId === userId
    );
  }

  async createSchedule(insertSchedule: InsertSchedule): Promise<Schedule> {
    const id = randomUUID();
    const now = new Date();
    const schedule: Schedule = { 
      ...insertSchedule, 
      id,
      enabled: insertSchedule.enabled ?? false,
      dayOfWeek: insertSchedule.dayOfWeek ?? null,
      dayOfMonth: insertSchedule.dayOfMonth ?? null,
      lastRun: null,
      createdAt: now,
      updatedAt: now
    };
    this.schedules.set(id, schedule);
    return schedule;
  }

  async updateSchedule(id: string, updates: Partial<InsertSchedule>): Promise<Schedule | undefined> {
    const existing = this.schedules.get(id);
    if (!existing) return undefined;

    const updated: Schedule = { 
      ...existing, 
      ...updates,
      updatedAt: new Date()
    };
    this.schedules.set(id, updated);
    return updated;
  }

  async deleteSchedule(id: string): Promise<boolean> {
    return this.schedules.delete(id);
  }

  async getActiveSchedules(): Promise<Schedule[]> {
    return Array.from(this.schedules.values()).filter(
      (schedule) => schedule.enabled
    );
  }

  async updateScheduleLastRun(id: string): Promise<void> {
    const schedule = this.schedules.get(id);
    if (schedule) {
      schedule.lastRun = new Date();
      schedule.updatedAt = new Date();
      this.schedules.set(id, schedule);
    }
  }

  // Generated playlist methods
  async getGeneratedPlaylist(id: string): Promise<GeneratedPlaylist | undefined> {
    return this.generatedPlaylists.get(id);
  }

  async getGeneratedPlaylistsByUserId(userId: string): Promise<GeneratedPlaylist[]> {
    return Array.from(this.generatedPlaylists.values()).filter(
      (playlist) => playlist.userId === userId
    );
  }

  async createGeneratedPlaylist(insertPlaylist: InsertGeneratedPlaylist): Promise<GeneratedPlaylist> {
    const id = randomUUID();
    const playlist: GeneratedPlaylist = { 
      ...insertPlaylist, 
      id,
      scheduleId: insertPlaylist.scheduleId ?? null,
      spotifyPlaylistId: insertPlaylist.spotifyPlaylistId ?? null,
      description: insertPlaylist.description ?? null,
      trackCount: insertPlaylist.trackCount ?? null,
      createdAt: new Date()
    };
    this.generatedPlaylists.set(id, playlist);
    return playlist;
  }
}

export const storage = new MemStorage();