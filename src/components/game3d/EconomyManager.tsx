import { supabase } from '@/integrations/supabase/client';

export interface PlayerEconomy {
  userId: string;
  cfCredits: number;
  inGameCash: number;
  bank: number;
  inventory: InventoryItem[];
  level: number;
  experience: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  type: 'weapon' | 'item' | 'clothing';
}

export interface Job {
  id: string;
  name: string;
  buildingId: string;
  payPerTask: number;
  taskDuration: number; // seconds
  description: string;
  icon: string;
}

const AVAILABLE_JOBS: Job[] = [
  {
    id: 'job_shop_clerk',
    name: 'Shop Clerk',
    buildingId: 'building_1',
    payPerTask: 500,
    taskDuration: 10,
    description: 'Stock shelves and help customers',
    icon: '🏪',
  },
  {
    id: 'job_construction',
    name: 'Construction Worker',
    buildingId: 'building_12',
    payPerTask: 800,
    taskDuration: 15,
    description: 'Help with building work',
    icon: '👷',
  },
  {
    id: 'job_delivery',
    name: 'Delivery Driver',
    buildingId: 'building_6',
    payPerTask: 1000,
    taskDuration: 12,
    description: 'Make deliveries around the city',
    icon: '🚗',
  },
  {
    id: 'job_security',
    name: 'Security Guard',
    buildingId: 'building_3',
    payPerTask: 1200,
    taskDuration: 20,
    description: 'Patrol and secure the area',
    icon: '🛡️',
  },
];

export class EconomyManager {
  private playerData: PlayerEconomy;
  private userId: string;

  constructor(userId: string, initialData?: Partial<PlayerEconomy>) {
    this.userId = userId;
    this.playerData = {
      userId,
      cfCredits: initialData?.cfCredits || 0,
      inGameCash: initialData?.inGameCash || 5000,
      bank: initialData?.bank || 0,
      inventory: initialData?.inventory || [],
      level: initialData?.level || 1,
      experience: initialData?.experience || 0,
    };
  }

  async loadFromSupabase(): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('game_characters')
        .select('cash, bank_balance, job_experience')
        .eq('user_id', this.userId)
        .single();

      if (error) throw error;
      if (data) {
        this.playerData.inGameCash = data.cash || 5000;
        this.playerData.bank = data.bank_balance || 0;
        this.playerData.level = Math.floor((data.job_experience || 0) / 500) + 1;
        this.playerData.experience = (data.job_experience || 0) % 500;
      }
    } catch (error) {
      console.error('Failed to load economy data:', error);
    }
  }

  async saveToSupabase(characterId: string): Promise<void> {
    try {
      // Calculate total experience from level + current experience
      const totalExperience = (this.playerData.level - 1) * 500 + this.playerData.experience;
      
      const { error } = await supabase
        .from('game_characters')
        .update({
          cash: this.playerData.inGameCash,
          bank_balance: this.playerData.bank,
          job_experience: totalExperience,
          updated_at: new Date().toISOString(),
        })
        .eq('id', characterId);

      if (error) throw error;
    } catch (error) {
      console.error('Failed to save economy data:', error);
    }
  }

  // Currency conversion
  convertCreditsToCache(credits: number): boolean {
    if (this.playerData.cfCredits < credits) {
      return false;
    }

    const cashAmount = credits * 1000; // 1 credit = 1000 cash
    this.playerData.cfCredits -= credits;
    this.playerData.inGameCash += cashAmount;
    return true;
  }

  convertCashToCredits(cash: number): boolean {
    if (this.playerData.inGameCash < cash) {
      return false;
    }

    const creditAmount = Math.floor(cash / 1000);
    this.playerData.inGameCash -= cash;
    this.playerData.cfCredits += creditAmount;
    return true;
  }

  // Job system
  completeJob(jobId: string): number {
    const job = AVAILABLE_JOBS.find((j) => j.id === jobId);
    if (!job) return 0;

    this.playerData.inGameCash += job.payPerTask;
    this.playerData.experience += 50;

    // Level up every 500 experience
    if (this.playerData.experience >= 500) {
      this.playerData.level += 1;
      this.playerData.experience -= 500;
    }

    return job.payPerTask;
  }

  depositToBank(amount: number): boolean {
    if (this.playerData.inGameCash < amount) {
      return false;
    }

    this.playerData.inGameCash -= amount;
    this.playerData.bank += amount;
    return true;
  }

  withdrawFromBank(amount: number): boolean {
    if (this.playerData.bank < amount) {
      return false;
    }

    this.playerData.bank -= amount;
    this.playerData.inGameCash += amount;
    return true;
  }

  // Getters
  getCash(): number {
    return this.playerData.inGameCash;
  }

  getBank(): number {
    return this.playerData.bank;
  }

  getCredits(): number {
    return this.playerData.cfCredits;
  }

  getLevel(): number {
    return this.playerData.level;
  }

  getExperience(): number {
    return this.playerData.experience;
  }

  getInventory(): InventoryItem[] {
    return this.playerData.inventory;
  }

  getAvailableJobs(): Job[] {
    return AVAILABLE_JOBS;
  }

  getJobById(jobId: string): Job | undefined {
    return AVAILABLE_JOBS.find((j) => j.id === jobId);
  }

  getAllData(): PlayerEconomy {
    return this.playerData;
  }
}
