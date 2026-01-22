import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Country, COUNTRIES } from '@/lib/countries';

interface CountrySelectorProps {
  selectedCountry: Country;
  onSelect: (country: Country) => void;
  className?: string;
}

export default function CountrySelector({ selectedCountry, onSelect, className = '' }: CountrySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary border border-border hover:border-primary/50 transition-all"
      >
        <span className="text-xl">{selectedCountry.flag}</span>
        <span className="font-medium">{selectedCountry.name}</span>
        <span className="text-muted-foreground">({selectedCountry.currency})</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)} 
          />
          <div className="absolute top-full left-0 mt-2 w-72 max-h-80 overflow-y-auto rounded-xl bg-card border border-border shadow-xl z-50">
            <div className="p-2">
              {COUNTRIES.map((country) => (
                <button
                  key={country.code}
                  onClick={() => {
                    onSelect(country);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all ${
                    selectedCountry.code === country.code
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-secondary'
                  }`}
                >
                  <span className="text-xl">{country.flag}</span>
                  <div className="flex-1">
                    <span className="font-medium">{country.name}</span>
                  </div>
                  <span className={`text-sm ${
                    selectedCountry.code === country.code 
                      ? 'text-primary-foreground/80' 
                      : 'text-muted-foreground'
                  }`}>
                    {country.currencySymbol} {country.currency}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}