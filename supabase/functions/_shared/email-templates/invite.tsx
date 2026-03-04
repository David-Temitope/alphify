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
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
}: InviteEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&display=swap');
      `}</style>
    </Head>
    <Preview>You've been invited to join Alphify — your AI study companion awaits! 🎉</Preview>
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

        <Heading style={h1}>You're invited! 🎉</Heading>
        <Text style={text}>
          Someone wants you to join{' '}
          <Link href={siteUrl} style={link}>
            <strong>Alphify</strong>
          </Link>
          {' '}— an AI-powered study companion that helps you learn smarter with personalized tutoring from Ezra.
        </Text>
        <Text style={text}>
          Tap below to accept and create your account:
        </Text>

        <Section style={buttonContainer}>
          <Button style={button} href={confirmationUrl}>
            Accept Invitation
          </Button>
        </Section>

        <Hr style={divider} />

        <Text style={footer}>
          Not expecting this? You can safely ignore this email.
        </Text>
        <Text style={footerBrand}>
          Alphify by Alphadominity · © {new Date().getFullYear()}
        </Text>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail

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
const link = { color: '#0CBDCF', textDecoration: 'underline' }
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
