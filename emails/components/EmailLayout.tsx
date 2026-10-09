import { Body, Container, Head, Hr, Html, Preview, Text, Link } from 'react-email';
import * as React from 'react';

interface Props {
  preview?: string;
  children: React.ReactNode;
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://ambassades-guerison.vercel.app';

export function EmailLayout({ preview, children }: Props) {
  return (
    <Html lang="fr">
      <Head />
      {preview && <Preview>{preview}</Preview>}
      <Body style={{ backgroundColor: '#ffffff', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif', margin: 0 }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto', padding: '24px 16px' }}>
          <Text style={header}>Ambassades de Guérison</Text>
          {children}
          <Hr style={hr} />
          <Text style={footer}>
            <Link href={APP_URL} style={footerLink}>Ambassades de Guérison</Link>
            {' '}— live de guérison avec David Théry
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const header: React.CSSProperties = { fontSize: '14px', fontWeight: '600', color: '#4f46e5', letterSpacing: '0.02em', margin: '0 0 20px' };
const hr: React.CSSProperties = { borderColor: '#f1f5f9', margin: '32px 0 16px' };
const footer: React.CSSProperties = { fontSize: '13px', color: '#94a3b8', margin: 0 };
const footerLink: React.CSSProperties = { color: '#94a3b8', textDecoration: 'underline' };
