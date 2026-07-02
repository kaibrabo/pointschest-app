export interface CreditCard {
  id: string;
  name: string;
  issuer: string;
  cardType: 'Travel' | 'Cash Back' | 'Business' | 'Student' | 'Secured';
  annualFee: number;
  rewards: {
    category: string;
    rate: number;
  }[];
  creditScore: {
    min: number;
    recommended: number;
  };
  applicationLink: string;
  welcomeBonus?: {
    amount: string;
    requirement: string;
  };
  benefits: string[];
  apr: {
    purchase: number;
    balance: number;
    cash: number;
  };
  imageUrl?: string;
}

export interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  creditScore: number;
  monthlySpend: {
    dining: number;
    groceries: number;
    gas: number;
    travel: number;
    other: number;
  };
  favoriteCards: string[]; // Array of card IDs
  joinDate: string;
}

export interface Reward {
  category: string;
  rate: number;
}