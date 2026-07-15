// src/services/memoryLayer.ts

export interface MemoryItem {
  id: string;
  type: 'conversation' | 'task' | 'client' | 'project' | 'note';
  content: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export class MemoryLayer {
  private memory: MemoryItem[] = [];

  // Add a new memory item
  addMemory(item: Omit<MemoryItem, 'id' | 'createdAt'>): MemoryItem {
    const newItem: MemoryItem = {
      ...item,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
    };

    this.memory.push(newItem);
    return newItem;
  }

  // Get all memory items
  getAllMemory(): MemoryItem[] {
    return this.memory;
  }

  // Get memory by type
  getMemoryByType(type: MemoryItem['type']): MemoryItem[] {
    return this.memory.filter(item => item.type === type);
  }

  // Search memory (basic keyword search)
  searchMemory(query: string): MemoryItem[] {
    const lowerQuery = query.toLowerCase();
    return this.memory.filter(item =>
      item.content.toLowerCase().includes(lowerQuery)
    );
  }

  // Clear all memory (useful for testing)
  clearMemory() {
    this.memory = [];
  }
}

// Export a singleton instance
export const memoryLayer = new MemoryLayer();