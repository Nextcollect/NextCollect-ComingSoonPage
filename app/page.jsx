import Navbar from './components/Navbar';
import Hero from './components/Hero';
import { AboutSection, FeaturesSection, CTASection } from './components/Section';
import Footer from './components/Footer';

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <AboutSection />
        <FeaturesSection />
        <CTASection />
      </main>
      <Footer />
    </>
  );
}
