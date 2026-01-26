import * as THREE from 'three';
import { supabase } from '@/integrations/supabase/client';

export interface PlayerInventory {
  id: string;
  cash: number;
  cfCredits: number;
  items: InventoryItem[];
  health: number;
  lastUpdated: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  type: 'weapon' | 'tool' | 'consumable' | 'clothing';
  quantity: number;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic';
}

export interface Job {
  id: string;
  name: string;
  description: string;
  reward: number;
  duration: number;
  buildingId: string;
  requirements?: string[];
}

export class EconomySystem {
  private playerId: string;
  private inventory: PlayerInventory | null = null;
  private jobs: Map<string, Job> = new Map();

  constructor(playerId: string) {
    this.playerId = playerId;
    this.initializeJobs();
  }

  private initializeJobs() {
    const jobs: Job[] = [
      {
        id: 'job_delivery',
        name: 'Package Delivery',
        description: 'Deliver packages across London',
        reward: 500,
        duration: 60,
        buildingId: 'building_9',
      },
      {
        id: 'job_security',
        name: 'Security Guard',
        description: 'Watch over the bank',
        reward: 750,
        duration: 120,
        buildingId: 'building_2',
      },
      {
        id: 'job_taxi',
        name: 'Taxi Driver',
        description: 'Drive passengers around London',
        reward: 600,
        duration: 90,
        buildingId: 'building_0',
      },
      {
        id: 'job_retail',
        name: 'Shop Assistant',
        description: 'Work in the retail shop',
        reward: 400,
        duration: 45,
        buildingId: 'building_1',
      },
      {
        id: 'job_hospital',
        name: 'Hospital Staff',
        description: 'Assist at the hospital',
        reward: 550,
        duration: 75,
        buildingId: 'building_4',
      },
    ];

    jobs.forEach((job) => {
      this.jobs.set(job.id, job);
    });
  }

  async loadInventory(): Promise<PlayerInventory> {
    try {
      const { data, error } = await supabase
        .from('game_characters')
        .select('*')
        .eq('id', this.playerId)
        .single();

      if (error) throw error;

      this.inventory = {
        id: this.playerId,
        cash: data.cash || 0,
        cfCredits: data.cf_credits || 0,
        items: data.inventory || [],
        health: data.health || 100,
        lastUpdated: new Date().toISOString(),
      };

      return this.inventory;
    } catch (error) {
      console.error('Failed to load inventory:', error);
      return {
        id: this.playerId,
        cash: 0,
        cfCredits: 0,
        items: [],
        health: 100,
        lastUpdated: new Date().toISOString(),
      };
    }
  }

  async convertCredits(amount: number): Promise<boolean> {
    if (!this.inventory) {
      await this.loadInventory();
    }

    if (!this.inventory || this.inventory.cfCredits < amount) {
      return false;
    }

    try {
      const newCash = this.inventory.cash + amount * 1000;
      const newCredits = this.inventory.cfCredits - amount;

      const { error } = await supabase
        .from('game_characters')
        .update({
          cash: newCash,
          cf_credits: newCredits,
          last_updated_at: new Date().toISOString(),
        })
        .eq('id', this.playerId);

      if (error) throw error;

      this.inventory.cash = newCash;
      this.inventory.cfCredits = newCredits;

      return true;
    } catch (error) {
      console.error('Failed to convert credits:', error);
      return false;
    }
  }

  async startJob(jobId: string): Promise<{ success: boolean; reward?: number; duration?: number }> {
    const job = this.jobs.get(jobId);
    if (!job) {
      return { success: false };
    }

    try {
      // Simulate job completion (in real app, would track progress)
      const { error } = await supabase
        .from('game_characters')
        .update({
          cash: (this.inventory?.cash || 0) + job.reward,
          current_job: jobId,
          last_updated_at: new Date().toISOString(),
        })
        .eq('id', this.playerId);

      if (error) throw error;

      if (this.inventory) {
        this.inventory.cash += job.reward;
      }

      return { success: true, reward: job.reward, duration: job.duration };
    } catch (error) {
      console.error('Failed to start job:', error);
      return { success: false };
    }
  }

  async addCash(amount: number): Promise<boolean> {
    try {
      const newCash = (this.inventory?.cash || 0) + amount;

      const { error } = await supabase
        .from('game_characters')
        .update({
          cash: newCash,
          last_updated_at: new Date().toISOString(),
        })
        .eq('id', this.playerId);

      if (error) throw error;

      if (this.inventory) {
        this.inventory.cash = newCash;
      }

      return true;
    } catch (error) {
      console.error('Failed to add cash:', error);
      return false;
    }
  }

  async takeDamage(amount: number): Promise<boolean> {
    try {
      const newHealth = Math.max((this.inventory?.health || 100) - amount, 0);

      const { error } = await supabase
        .from('game_characters')
        .update({
          health: newHealth,
          last_updated_at: new Date().toISOString(),
        })
        .eq('id', this.playerId);

      if (error) throw error;

      if (this.inventory) {
        this.inventory.health = newHealth;
      }

      return true;
    } catch (error) {
      console.error('Failed to update health:', error);
      return false;
    }
  }

  async heal(amount: number): Promise<boolean> {
    try {
      const newHealth = Math.min((this.inventory?.health || 100) + amount, 100);

      const { error } = await supabase
        .from('game_characters')
        .update({
          health: newHealth,
          last_updated_at: new Date().toISOString(),
        })
        .eq('id', this.playerId);

      if (error) throw error;

      if (this.inventory) {
        this.inventory.health = newHealth;
      }

      return true;
    } catch (error) {
      console.error('Failed to heal:', error);
      return false;
    }
  }

  getJob(jobId: string): Job | undefined {
    return this.jobs.get(jobId);
  }

  getAllJobs(): Job[] {
    return Array.from(this.jobs.values());
  }

  getInventory(): PlayerInventory | null {
    return this.inventory;
  }
}
