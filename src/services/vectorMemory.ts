// src/services/vectorMemory.ts

export interface VectorMemoryItem {
  id: string;
  content: string;
  embedding?: number[]; // Will be used later when we integrate real embeddings
  metadata?: Record<string, any>;
  createdAt: string;
}

export class VectorMemory {
  private memories: VectorMemoryItem[] = [];

  // Add a new memory item
  addMemory(content: string, metadata?: Record<string, any>): VectorMemoryItem {
    const newMemory: VectorMemoryItem = {
      id: Date.now().toString(),
      content,
      metadata,
      createdAt: new Date().toISOString(),
    };

    this.memories.push(newMemory);
    return newMemory;
  }

  // Get all memories
  getAllMemories(): VectorMemoryItem[] {
    return this.memories;
  }

  // Search memories by simple keyword (placeholder for future vector search)
  searchMemories(query: string): VectorMemoryItem[] {
    const lowerQuery = query.toLowerCase();
    return this.memories.filter(item =>
      item.content.toLowerCase().includes(lowerQuery)
    );
  }

  // Get memory by ID
  getMemoryById(id: string): VectorMemoryItem | undefined {
    return this.memories.find(m => m.id === id);
  }

  // Clear all memories (useful for testing)
  clearMemories() {
    this.memories = [];
  }
}

// Export a singleton instance
export const vectorMemory = new VectorMemory();