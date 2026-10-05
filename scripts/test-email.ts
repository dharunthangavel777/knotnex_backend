import { EmailService } from '../src/integrations/email/email.service';
import dotenv from 'dotenv';
dotenv.config();

async function testEmail() {
  const recipient = process.argv[2] || process.env.BREVO_FROM_EMAIL || 'knotnex.developer@gmail.com';
  console.log(`Sending test customized HTML email via Brevo to: ${recipient}...`);

  try {
    const result = await EmailService.sendWelcomeEmail(recipient, 'Knotnex Developer');
    console.log('✅ Test email sent successfully!', result);
  } catch (err: any) {
    console.error('❌ Failed to send email:', err.message);
  }
}

testEmail();
