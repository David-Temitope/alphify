/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
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

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&display=swap');
      `}</style>
    </Head>
    <Preview>Your Alphify verification code 🔐</Preview>
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

        <Heading style={h1}>Verification code 🔐</Heading>
        <Text style={text}>Use this code to confirm your identity:</Text>

        <Section style={codeContainer}>
          <Text style={codeStyle}>{token}</Text>
        </Section>

        <Hr style={divider} />

        <Text style={footer}>
          This code expires shortly. If you didn't request it, you can safely ignore this email.
        </Text>
        <Text style={footerBrand}>
          Alphify by Alphadominity · © {new Date().getFullYear()}
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

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
const codeContainer = {
  textAlign: 'center' as const,
  margin: '24px 0 32px',
  backgroundColor: '#f1f5f9',
  borderRadius: '12px',
  padding: '20px',
}
const codeStyle = {
  fontFamily: "'JetBrains Mono', Courier, monospace",
  fontSize: '32px',
  fontWeight: 'bold' as const,
  color: '#0CBDCF',
  letterSpacing: '6px',
  margin: '0',
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
