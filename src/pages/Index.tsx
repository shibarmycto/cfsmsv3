import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import Navbar from '@/components/landing/Navbar';
import HeroSection from '@/components/landing/HeroSection';
import BlockchainSection from '@/components/landing/BlockchainSection';
import FeaturesGrid from '@/components/landing/FeaturesGrid';
import AISection from '@/components/landing/AISection';
import WhySection from '@/components/landing/WhySection';
import CTASection from '@/components/landing/CTASection';
import Footer from '@/components/landing/Footer';
import FloatingBanners from '@/components/landing/FloatingBanners';

export default function Index() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleGetStarted = () => {
    if (user) {
      navigate('/dashboard');
    } else {
      navigate('/auth');
    }
  };

  const handleViewFeatures = () => {
    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen hero-gradient">
      <Navbar />
      <FloatingBanners />
      <HeroSection onGetStarted={handleGetStarted} onViewPricing={handleViewFeatures} />
      <BlockchainSection />
      <FeaturesGrid />
      <AISection />
      <WhySection />
      <CTASection onGetStarted={handleGetStarted} />
      <Footer />
    </div>
  );
}
