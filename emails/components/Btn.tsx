import { Button } from 'react-email';
import * as React from 'react';

interface Props {
  href: string;
  children: React.ReactNode;
  color?: 'indigo' | 'green' | 'red';
}

const COLORS = {
  indigo: '#4F46E5',
  green:  '#059669',
  red:    '#dc2626',
};

export function Btn({ href, children, color = 'indigo' }: Props) {
  return (
    <Button
      href={href}
      style={{
        backgroundColor: COLORS[color],
        color: '#ffffff',
        padding: '10px 20px',
        borderRadius: '6px',
        textDecoration: 'none',
        display: 'inline-block',
        fontSize: '14px',
        fontWeight: '500',
      }}
    >
      {children}
    </Button>
  );
}
