/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&display=swap');
      `}</style>
    </Head>
    <Preview>Welcome to Alphify — let's get you started! 🎓</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}>
          <Img
            src="https://alphify.site/alphify-icon-192.png"
            width="56"
            height="56"
            alt="Alphify"
            style={logo}
          />
        </Section>

        <Heading style={h1}>Welcome aboard! 🎓</Heading>
        <Text style={text}>
          Hey there! You're one step away from meeting <strong style={highlight}>Ezra</strong> — your personal AI study companion who adapts to your learning style.
        </Text>
        <Text style={text}>
          Tap the button below to verify your email and unlock your account:
        </Text>

        <Section style={buttonContainer}>
          <Button style={button} href={confirmationUrl}>
            Verify My Email
          </Button>
        </Section>

        <Text style={smallText}>
          If the button doesn't work, copy and paste this link into your browser:
        </Text>
        <Text style={linkText}>{confirmationUrl}</Text>

        <Hr style={divider} />

        <Text style={footer}>
          You're receiving this because someone signed up at Alphify with this email. If it wasn't you, just ignore this.
        </Text>
        <Text style={footerBrand}>
          Alphify by Alphadominity · © {new Date().getFullYear()}
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

const main = {
  backgroundColor: '#ffffff',
  fontFamily: "'Inter', 'Space Grotesk', Arial, sans-serif",
}
const container = {
  maxWidth: '480px',
  margin: '0 auto',
  padding: '40px 28px 32px',
}
const headerSection = { marginBottom: '28px' }
const logo = { borderRadius: '14px' }
const h1 = {
  fontSize: '26px',
  fontWeight: 'bold' as const,
  color: '#0f172a',
  margin: '0 0 16px',
  fontFamily: "'Space Grotesk', Arial, sans-serif",
}
const text = {
  fontSize: '15px',
  color: '#475569',
  lineHeight: '1.7',
  margin: '0 0 16px',
}
const highlight = { color: '#0CBDCF' }
const buttonContainer = { textAlign: 'center' as const, margin: '28px 0' }
const button = {
  backgroundColor: '#0CBDCF',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: '600' as const,
  borderRadius: '12px',
  padding: '14px 32px',
  textDecoration: 'none',
  display: 'inline-block',
}
const smallText = {
  fontSize: '12px',
  color: '#94a3b8',
  lineHeight: '1.5',
  margin: '0 0 4px',
}
const linkText = {
  fontSize: '12px',
  color: '#0CBDCF',
  lineHeight: '1.5',
  wordBreak: 'break-all' as const,
  margin: '0 0 24px',
}
const divider = { borderColor: '#e2e8f0', margin: '28px 0' }
const footer = {
  fontSize: '12px',
  color: '#94a3b8',
  lineHeight: '1.5',
  margin: '0 0 8px',
}
const footerBrand = {
  fontSize: '11px',
  color: '#cbd5e1',
  margin: '0',
  fontFamily: "'Space Grotesk', Arial, sans-serif",
}
