import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { 
  HelpCircle, 
  Pickaxe, 
  Wallet, 
  ArrowLeftRight, 
  Shield, 
  Bot, 
  Users,
  Bitcoin,
  Phone,
  MessageSquare
} from 'lucide-react';

export default function FAQs() {
  const faqCategories = [
    {
      icon: HelpCircle,
      title: 'General Questions',
      faqs: [
        {
          question: 'What is CFSMS Network?',
          answer: 'CFSMS (CRYPTO FUND SMS) Network is a revolutionary blockchain platform that combines mining, social finance, and AI-powered features into one seamless ecosystem. Unlike traditional blockchains that require expensive hardware and technical expertise, CFSMS is built for everyone — making blockchain participation, mining, and real crypto rewards more accessible than ever before.',
        },
        {
          question: 'What does CFSMS stand for?',
          answer: 'CFSMS stands for CRYPTO FUND SMS Network. It represents our mission to create a fast, simple, and user-first crypto ecosystem that bridges the gap between social networking and decentralized finance.',
        },
        {
          question: 'How is CFSMS different from other blockchains?',
          answer: 'Many blockchains are powerful but difficult to use. CFSMS focuses on speed, simplicity, and usability — making crypto friendly for beginners while still delivering real blockchain value. We combine mining, social interaction, AI automation, instant transfers, and real crypto withdrawals all in one platform.',
        },
        {
          question: 'Is CFSMS free to use?',
          answer: 'Yes! Creating an account and participating in the network is completely free. You can start mining, chatting, and earning rewards without any upfront investment. Premium features and larger transaction capabilities are available through our token system.',
        },
      ],
    },
    {
      icon: Pickaxe,
      title: 'Mining',
      faqs: [
        {
          question: 'What is built-in mining?',
          answer: 'Built-in mining allows you to mine directly inside the CFSMS ecosystem without expensive hardware or complex setup. Simply complete tasks like solving captchas and watching content to earn tokens. Mining is active until 2028, giving users long-term opportunities to earn rewards.',
        },
        {
          question: 'How long is mining available?',
          answer: 'Mining on the CFSMS Network is active until 2028. This gives early adopters years to accumulate tokens and participate in the network growth before mining rewards are reduced or ended.',
        },
        {
          question: 'Do I need expensive hardware to mine?',
          answer: 'No! Unlike traditional cryptocurrency mining that requires specialized hardware (GPUs, ASICs), CFSMS mining happens directly in your browser. You just need a computer or smartphone with internet access.',
        },
        {
          question: 'What is Hourly Bitcoin Roll Mining?',
          answer: 'Hourly Bitcoin Roll Mining is a fun, engaging feature where users can roll every hour for a chance to earn Bitcoin rewards. This adds an element of excitement to participation while delivering real crypto value.',
        },
      ],
    },
    {
      icon: Wallet,
      title: 'Wallet & Transfers',
      faqs: [
        {
          question: 'How do instant @username transfers work?',
          answer: 'You can send tokens to any user on the network instantly by using their @username. Simply enter the amount and recipient username — the transfer happens immediately with no waiting time. It\'s as easy as sending a message on social media.',
        },
        {
          question: 'How fast are withdrawals?',
          answer: 'Withdrawals are processed quickly with minimal waiting time. Once approved, you can access your funds and convert them to USDC or BTC for real-world crypto utility.',
        },
        {
          question: 'What cryptocurrencies can I withdraw to?',
          answer: 'Currently, you can withdraw and convert your CFSMS credits into USDC (stablecoin) or BTC (Bitcoin). More withdrawal options may be added as the network grows.',
        },
        {
          question: 'Are there transaction fees?',
          answer: 'Internal transfers between CFSMS users are free or have minimal fees. Withdrawals to external wallets may incur standard network fees depending on the cryptocurrency and blockchain congestion.',
        },
      ],
    },
    {
      icon: ArrowLeftRight,
      title: 'Buying & Converting',
      faqs: [
        {
          question: 'How can I buy CFSMS credits?',
          answer: 'You can purchase CFSMS credits using cryptocurrency (Bitcoin, Ethereum, USDT) or through other supported payment methods. Credits are added to your account after payment confirmation.',
        },
        {
          question: 'What can I do with CFSMS credits?',
          answer: 'Credits can be used to access premium features, send SMS campaigns, boost your mining rewards, tip other users, and more. They\'re the utility token of the entire CFSMS ecosystem.',
        },
        {
          question: 'Can I convert credits back to crypto?',
          answer: 'Yes! You can withdraw your credits and convert them into USDC or BTC. This provides real-world crypto utility for the tokens you earn through mining and participation.',
        },
      ],
    },
    {
      icon: Bot,
      title: 'AI Features',
      faqs: [
        {
          question: 'What is the AI Smart Agent?',
          answer: 'The AI Smart Agent is an automated system that runs promotional campaigns, optimizes engagement, helps reach the right audience, and supports intelligent network growth. It\'s designed to keep the ecosystem active, efficient, and scalable.',
        },
        {
          question: 'What is the AI Virtual Twin?',
          answer: 'Your AI Virtual Twin is a personal AI companion that can answer phone calls on your behalf. It holds natural, emotionally intelligent conversations, remembers past interactions with callers, and adapts to each person\'s personality. Think of it as a warm, friendly digital version of yourself.',
        },
        {
          question: 'How does the AI Twin remember callers?',
          answer: 'The AI Twin has a persistent memory system that stores caller names, emotional patterns, topics they care about, and important life events they mention. This allows for personalized, meaningful conversations that feel genuinely human.',
        },
        {
          question: 'Is the AI Twin available 24/7?',
          answer: 'Yes! Your AI Twin can answer calls at any time, making sure you never miss an important connection. It\'s like having a helpful assistant who\'s always available.',
        },
      ],
    },
    {
      icon: Users,
      title: 'Community & Social',
      faqs: [
        {
          question: 'What is the Community Forum?',
          answer: 'The CFSMS Community Forum is where users can create discussion topics, share ideas and strategies, meet new friends, and build crypto-focused communities. It transforms CFSMS from just a blockchain into a social crypto network.',
        },
        {
          question: 'How does Watch-to-Earn work?',
          answer: 'Watch-to-Earn allows you to earn credits by watching YouTube videos. At the same time, advertisers can pay for YouTube promotions through the platform — creating a win-win ecosystem where users earn and brands reach their audience.',
        },
        {
          question: 'Can I chat with other users?',
          answer: 'Yes! CFSMS has a built-in chat system where you can message friends, transact, and connect seamlessly. It\'s designed to make the network feel social and engaging.',
        },
        {
          question: 'What is the verified badge?',
          answer: 'Verified badges (blue checkmarks) are awarded to trusted users who have been verified by administrators. It helps identify legitimate, active members of the community.',
        },
      ],
    },
    {
      icon: Shield,
      title: 'Security & Safety',
      faqs: [
        {
          question: 'Is CFSMS secure?',
          answer: 'Yes! CFSMS uses enterprise-grade security with decentralized architecture. Your funds and data are protected with industry-standard encryption and security practices.',
        },
        {
          question: 'What if I forget my password?',
          answer: 'You can reset your password using the "Forgot Password" link on the login page. A reset link will be sent to your registered email address.',
        },
        {
          question: 'Can I enable two-factor authentication?',
          answer: 'Security features including 2FA are continuously being enhanced. Check the settings page for the latest security options available.',
        },
        {
          question: 'How do I report suspicious activity?',
          answer: 'If you notice any suspicious activity, please contact our support team immediately via email at customercare@cfsmsbulk.com or through our Telegram support channel.',
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen hero-gradient">
      <Navbar />
      
      {/* Hero */}
      <section className="container mx-auto px-6 py-16 text-center">
        <div className="max-w-3xl mx-auto animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-6">
            <HelpCircle className="w-4 h-4" />
            Frequently Asked Questions
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            Everything About <span className="text-gradient">CFSMS</span>
          </h1>
          <p className="text-xl text-muted-foreground">
            Learn about our blockchain network, mining, AI features, and how to get the most out of the CFSMS ecosystem.
          </p>
        </div>
      </section>

      {/* FAQ Categories */}
      <section className="container mx-auto px-6 py-12">
        <div className="max-w-4xl mx-auto space-y-8">
          {faqCategories.map((category, categoryIndex) => (
            <div 
              key={category.title} 
              className="glass-card p-6 animate-fade-in"
              style={{ animationDelay: `${categoryIndex * 0.1}s` }}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <category.icon className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-xl font-bold">{category.title}</h2>
              </div>
              
              <Accordion type="single" collapsible className="space-y-2">
                {category.faqs.map((faq, faqIndex) => (
                  <AccordionItem 
                    key={faqIndex} 
                    value={`${categoryIndex}-${faqIndex}`}
                    className="border border-border rounded-lg px-4"
                  >
                    <AccordionTrigger className="text-left py-4 hover:no-underline">
                      <span className="font-medium">{faq.question}</span>
                    </AccordionTrigger>
                    <AccordionContent className="pb-4 text-muted-foreground leading-relaxed">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          ))}
        </div>
      </section>

      {/* Contact CTA */}
      <section className="container mx-auto px-6 py-16">
        <div className="glass-card glow-border p-8 text-center max-w-2xl mx-auto">
          <MessageSquare className="w-12 h-12 text-primary mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-4">Still Have Questions?</h2>
          <p className="text-muted-foreground mb-6">
            Can't find what you're looking for? Our support team is here to help.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a 
              href="mailto:customercare@cfsmsbulk.com"
              className="px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
            >
              Email Support
            </a>
            <a 
              href="https://t.me/cfsmsbulkofficialchat"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 rounded-lg bg-[#0088cc] text-white font-medium hover:opacity-90 transition-opacity"
            >
              Telegram Support
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
