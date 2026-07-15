// src/services/vectorMemoryIntegration.ts

import { vectorMemory, VectorMemoryItem } from './vectorMemory';

export class VectorMemoryIntegration {
  // Add a memory item with optional metadata
  addMemory(content: string, metadata?: Record<string, any>): VectorMemoryItem {
    return vectorMemory.addMemory(content, metadata);
  }

  // Search memories using simple keyword matching (placeholder for future vector search)
  searchMemories(query: string): VectorMemoryItem[] {
    return vectorMemory.searchMemories(query);
  }

  // Get all memories
  getAllMemories(): VectorMemoryItem[] {
    return vectorMemory.getAllMemories();
  }

  // Get memory by ID
  getMemoryById(id: string): VectorMemoryItem | undefined {
    return vectorMemory.getMemoryById(id);
  }

  // Clear all memories (for testing)
  clearMemories() {
    vectorMemory.clearMemories();
  }
}

// Export a singleton instance
export const vectorMemoryIntegration = new VectorMemoryIntegration();