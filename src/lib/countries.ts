export interface Country {
  code: string;
  name: string;
  flag: string;
  currency: string;
  currencySymbol: string;
  rate: number; // Conversion rate from USD base
}

export const COUNTRIES: Country[] = [
  { code: 'US', name: 'United States', flag: '🇺🇸', currency: 'USD', currencySymbol: '$', rate: 1 },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', currency: 'GBP', currencySymbol: '£', rate: 0.79 },
  { code: 'EU', name: 'Europe (EUR)', flag: '🇪🇺', currency: 'EUR', currencySymbol: '€', rate: 0.92 },
  { code: 'CA', name: 'Canada', flag: '🇨🇦', currency: 'CAD', currencySymbol: 'C$', rate: 1.36 },
  { code: 'AU', name: 'Australia', flag: '🇦🇺', currency: 'AUD', currencySymbol: 'A$', rate: 1.53 },
  { code: 'IN', name: 'India', flag: '🇮🇳', currency: 'INR', currencySymbol: '₹', rate: 83 },
  { code: 'AE', name: 'UAE', flag: '🇦🇪', currency: 'AED', currencySymbol: 'د.إ', rate: 3.67 },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬', currency: 'SGD', currencySymbol: 'S$', rate: 1.34 },
  { code: 'JP', name: 'Japan', flag: '🇯🇵', currency: 'JPY', currencySymbol: '¥', rate: 150 },
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦', currency: 'ZAR', currencySymbol: 'R', rate: 18.50 },
  { code: 'NG', name: 'Nigeria', flag: '🇳🇬', currency: 'NGN', currencySymbol: '₦', rate: 1550 },
  { code: 'KE', name: 'Kenya', flag: '🇰🇪', currency: 'KES', currencySymbol: 'KSh', rate: 130 },
  { code: 'PH', name: 'Philippines', flag: '🇵🇭', currency: 'PHP', currencySymbol: '₱', rate: 56 },
  { code: 'PK', name: 'Pakistan', flag: '🇵🇰', currency: 'PKR', currencySymbol: '₨', rate: 280 },
  { code: 'BD', name: 'Bangladesh', flag: '🇧🇩', currency: 'BDT', currencySymbol: '৳', rate: 110 },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷', currency: 'BRL', currencySymbol: 'R$', rate: 5.00 },
  { code: 'MX', name: 'Mexico', flag: '🇲🇽', currency: 'MXN', currencySymbol: 'MX$', rate: 17.20 },
  { code: 'DE', name: 'Germany', flag: '🇩🇪', currency: 'EUR', currencySymbol: '€', rate: 0.92 },
  { code: 'FR', name: 'France', flag: '🇫🇷', currency: 'EUR', currencySymbol: '€', rate: 0.92 },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱', currency: 'EUR', currencySymbol: '€', rate: 0.92 },
];

// $1 = 1 credit. Packages are priced in USD.
export const SMS_PACKAGES = [
  { credits: 10, basePrice: 10 },
  { credits: 50, basePrice: 50 },
  { credits: 100, basePrice: 100 },
  { credits: 500, basePrice: 500, popular: true },
  { credits: 1000, basePrice: 1000 },
  { credits: 5000, basePrice: 5000 },
];

export function formatPrice(basePrice: number, country: Country): string {
  const convertedPrice = Math.round(basePrice * country.rate);
  const formattedNumber = convertedPrice.toLocaleString();
  return `${country.currencySymbol}${formattedNumber}`;
}

export function getConvertedPrice(basePrice: number, country: Country): number {
  return Math.round(basePrice * country.rate);
}
