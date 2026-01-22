export interface Country {
  code: string;
  name: string;
  flag: string;
  currency: string;
  currencySymbol: string;
  rate: number; // Conversion rate from GBP base
}

export const COUNTRIES: Country[] = [
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', currency: 'GBP', currencySymbol: '£', rate: 1 },
  { code: 'US', name: 'United States', flag: '🇺🇸', currency: 'USD', currencySymbol: '$', rate: 1.27 },
  { code: 'EU', name: 'Europe (EUR)', flag: '🇪🇺', currency: 'EUR', currencySymbol: '€', rate: 1.17 },
  { code: 'CA', name: 'Canada', flag: '🇨🇦', currency: 'CAD', currencySymbol: 'C$', rate: 1.72 },
  { code: 'AU', name: 'Australia', flag: '🇦🇺', currency: 'AUD', currencySymbol: 'A$', rate: 1.93 },
  { code: 'IN', name: 'India', flag: '🇮🇳', currency: 'INR', currencySymbol: '₹', rate: 105 },
  { code: 'AE', name: 'UAE', flag: '🇦🇪', currency: 'AED', currencySymbol: 'د.إ', rate: 4.67 },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬', currency: 'SGD', currencySymbol: 'S$', rate: 1.70 },
  { code: 'JP', name: 'Japan', flag: '🇯🇵', currency: 'JPY', currencySymbol: '¥', rate: 190 },
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦', currency: 'ZAR', currencySymbol: 'R', rate: 23.50 },
  { code: 'NG', name: 'Nigeria', flag: '🇳🇬', currency: 'NGN', currencySymbol: '₦', rate: 1950 },
  { code: 'KE', name: 'Kenya', flag: '🇰🇪', currency: 'KES', currencySymbol: 'KSh', rate: 165 },
  { code: 'PH', name: 'Philippines', flag: '🇵🇭', currency: 'PHP', currencySymbol: '₱', rate: 71 },
  { code: 'PK', name: 'Pakistan', flag: '🇵🇰', currency: 'PKR', currencySymbol: '₨', rate: 355 },
  { code: 'BD', name: 'Bangladesh', flag: '🇧🇩', currency: 'BDT', currencySymbol: '৳', rate: 140 },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷', currency: 'BRL', currencySymbol: 'R$', rate: 6.35 },
  { code: 'MX', name: 'Mexico', flag: '🇲🇽', currency: 'MXN', currencySymbol: 'MX$', rate: 21.80 },
  { code: 'DE', name: 'Germany', flag: '🇩🇪', currency: 'EUR', currencySymbol: '€', rate: 1.17 },
  { code: 'FR', name: 'France', flag: '🇫🇷', currency: 'EUR', currencySymbol: '€', rate: 1.17 },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱', currency: 'EUR', currencySymbol: '€', rate: 1.17 },
];

export const SMS_PACKAGES = [
  { credits: 100, basePrice: 15 },
  { credits: 500, basePrice: 75 },
  { credits: 1000, basePrice: 150 },
  { credits: 5000, basePrice: 750, popular: true },
  { credits: 10000, basePrice: 1500 },
  { credits: 20000, basePrice: 3000 },
];

export function formatPrice(basePrice: number, country: Country): string {
  const convertedPrice = Math.round(basePrice * country.rate);
  
  // Format large numbers with commas
  const formattedNumber = convertedPrice.toLocaleString();
  
  return `${country.currencySymbol}${formattedNumber}`;
}

export function getConvertedPrice(basePrice: number, country: Country): number {
  return Math.round(basePrice * country.rate);
}