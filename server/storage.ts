import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { conversations, messages, type Conversation, type Message, type InsertConversation, type InsertMessage } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

const dbPath = process.env.DATABASE_URL || "azure_assistant.db";
const sqlite = new Database(dbPath);
const db = drizzle(sqlite);

// Create tables if they don't exist
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    sources TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL
  );
`);

export interface IStorage {
  getConversations(): Conversation[];
  getConversation(id: number): Conversation | undefined;
  createConversation(data: InsertConversation): Conversation;
  deleteConversation(id: number): void;
  getMessages(conversationId: number): Message[];
  createMessage(data: InsertMessage): Message;
}

export class Storage implements IStorage {
  getConversations(): Conversation[] {
    return db.select().from(conversations).orderBy(desc(conversations.id)).all();
  }

  getConversation(id: number): Conversation | undefined {
    return db.select().from(conversations).where(eq(conversations.id, id)).get();
  }

  createConversation(data: InsertConversation): Conversation {
    return db.insert(conversations).values(data).returning().get();
  }

  deleteConversation(id: number): void {
    db.delete(messages).where(eq(messages.conversationId, id)).run();
    db.delete(conversations).where(eq(conversations.id, id)).run();
  }

  getMessages(conversationId: number): Message[] {
    return db.select().from(messages).where(eq(messages.conversationId, conversationId)).all();
  }

  createMessage(data: InsertMessage): Message {
    return db.insert(messages).values(data).returning().get();
  }
}

export const storage = new Storage();
