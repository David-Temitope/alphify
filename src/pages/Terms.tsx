import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import praxelLogo from '@/assets/praxel-logo.png';

export default function Terms() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-4xl mx-auto flex items-center justify-between p-4 md:px-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            <div className="flex items-center gap-3">
              <img src={praxelLogo} alt="Praxel" className="w-8 h-8 rounded-lg" />
              <h1 className="font-display font-semibold text-xl text-foreground">Terms of Service</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 md:p-8 prose prose-sm dark:prose-invert max-w-none">
        <p className="text-muted-foreground text-sm">Last updated: February 16, 2026</p>

        <h2 className="font-display text-xl font-semibold mt-8 mb-4 text-foreground">1. Acceptance of Terms</h2>
        <p className="text-muted-foreground leading-relaxed">
          By accessing or using Praxel ("the Platform"), operated by Alphadominity ("we", "us", "our"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Platform.
        </p>

        <h2 className="font-display text-xl font-semibold mt-8 mb-4 text-foreground">2. Description of Service</h2>
        <p className="text-muted-foreground leading-relaxed">
          Praxel is an AI-powered educational platform that provides personalized tutoring through an AI assistant named Ezra. The Platform offers features including but not limited to: AI-powered explanations, document analysis, adaptive testing, study sessions, and community collaboration tools.
        </p>

        <h2 className="font-display text-xl font-semibold mt-8 mb-4 text-foreground">3. User Accounts</h2>
        <p className="text-muted-foreground leading-relaxed">
          You must create an account to use the Platform. You are responsible for maintaining the confidentiality of your login credentials and for all activities that occur under your account. You must provide accurate and complete information during registration.
        </p>

        <h2 className="font-display text-xl font-semibold mt-8 mb-4 text-foreground">4. Knowledge Units (KU) and Payments</h2>
        <p className="text-muted-foreground leading-relaxed">
          The Platform uses a credit system called Knowledge Units (KU). KU are purchased with real currency and are consumed when interacting with Ezra. KU are non-refundable once purchased. We reserve the right to modify pricing at any time with reasonable notice.
        </p>

        <h2 className="font-display text-xl font-semibold mt-8 mb-4 text-foreground">5. Acceptable Use</h2>
        <p className="text-muted-foreground leading-relaxed">You agree not to:</p>
        <ul className="text-muted-foreground space-y-2 list-disc pl-6">
          <li>Use the Platform for any unlawful purpose</li>
          <li>Attempt to gain unauthorized access to other users' accounts or data</li>
          <li>Upload malicious files or content</li>
          <li>Use the Platform to generate content that violates academic integrity policies</li>
          <li>Resell, redistribute, or commercially exploit the Platform without authorization</li>
          <li>Interfere with or disrupt the Platform's infrastructure</li>
        </ul>

        <h2 className="font-display text-xl font-semibold mt-8 mb-4 text-foreground">6. AI-Generated Content Disclaimer</h2>
        <p className="text-muted-foreground leading-relaxed">
          Ezra is an AI assistant and may occasionally produce inaccurate or incomplete information. The Platform is intended as a supplementary educational tool and should not replace professional academic instruction, textbooks, or verified educational materials. Users are responsible for verifying the accuracy of AI-generated content.
        </p>

        <h2 className="font-display text-xl font-semibold mt-8 mb-4 text-foreground">7. Intellectual Property</h2>
        <p className="text-muted-foreground leading-relaxed">
          The Praxel name, logo, and all associated branding are the exclusive property of Alphadominity. All content, features, and functionality of the Platform are owned by Alphadominity and are protected by international copyright, trademark, and other intellectual property laws. Users retain ownership of content they upload but grant us a license to process it for Platform functionality.
        </p>

        <h2 className="font-display text-xl font-semibold mt-8 mb-4 text-foreground">8. User-Uploaded Content</h2>
        <p className="text-muted-foreground leading-relaxed">
          You are solely responsible for the content you upload. By uploading files, you represent that you have the right to do so and that the content does not infringe on any third party's rights. Department admins who upload shared files confirm they have appropriate authorization.
        </p>

        <h2 className="font-display text-xl font-semibold mt-8 mb-4 text-foreground">9. Privacy and Data</h2>
        <p className="text-muted-foreground leading-relaxed">
          We collect and process personal data as necessary to provide the Platform. Your conversations with Ezra are stored to maintain context and improve the service. We do not sell your personal data to third parties. Account deletion permanently removes your data after a 7-day grace period.
        </p>

        <h2 className="font-display text-xl font-semibold mt-8 mb-4 text-foreground">10. Study Groups and Community</h2>
        <p className="text-muted-foreground leading-relaxed">
          Users participating in study groups and community features must conduct themselves respectfully. We reserve the right to suspend or terminate groups that violate these terms. Group administrators are responsible for the content shared within their groups.
        </p>

        <h2 className="font-display text-xl font-semibold mt-8 mb-4 text-foreground">11. Limitation of Liability</h2>
        <p className="text-muted-foreground leading-relaxed">
          To the maximum extent permitted by law, Alphadominity shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of the Platform. Our total liability shall not exceed the amount you have paid us in the 12 months preceding the claim.
        </p>

        <h2 className="font-display text-xl font-semibold mt-8 mb-4 text-foreground">12. Service Availability</h2>
        <p className="text-muted-foreground leading-relaxed">
          We strive to maintain uninterrupted service but do not guarantee 100% uptime. We may temporarily suspend the Platform for maintenance, updates, or unforeseen circumstances without prior notice.
        </p>

        <h2 className="font-display text-xl font-semibold mt-8 mb-4 text-foreground">13. Termination</h2>
        <p className="text-muted-foreground leading-relaxed">
          We reserve the right to suspend or terminate your account at our discretion if you violate these Terms. You may delete your account at any time through the Settings page. Upon termination, your right to use the Platform ceases immediately.
        </p>

        <h2 className="font-display text-xl font-semibold mt-8 mb-4 text-foreground">14. Changes to Terms</h2>
        <p className="text-muted-foreground leading-relaxed">
          We may update these Terms from time to time. Continued use of the Platform after changes constitutes acceptance. We will notify users of material changes via email or in-app notification.
        </p>

        <h2 className="font-display text-xl font-semibold mt-8 mb-4 text-foreground">15. Contact</h2>
        <p className="text-muted-foreground leading-relaxed">
          For questions about these Terms, contact Alphadominity through the Platform's support channels.
        </p>

        <div className="mt-12 pt-6 border-t border-border text-center">
          <p className="text-muted-foreground text-sm">© 2026 Alphadominity. All rights reserved.</p>
        </div>
      </main>
    </div>
  );
}
