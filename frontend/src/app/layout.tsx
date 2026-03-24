/**
 * Root layout component for the crypto wallet application
 * 
 * This layout wraps all pages and provides:
 * - Global styles and fonts
 * - Navigation structure
 * - Wallet state context
 * - Security headers and meta tags
 */

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import NavBar from '@/components/wallet/NavBar';

// Load Inter font with Latin subset for better performance
const inter = Inter({ subsets: ['latin'] });

// Metadata for the application
export const metadata: Metadata = {
  title: 'CryptoWallet - Secure Multi-Chain Wallet',
  description: 'A secure, self-custodial cryptocurrency wallet supporting multiple blockchains',
  keywords: ['cryptocurrency', 'wallet', 'bitcoin', 'ethereum', 'solana', 'defi', 'web3'],
  authors: [{ name: 'Crypto Wallet Developer' }],
  
  // Security and privacy headers
  robots: 'noindex, nofollow', // Don't index during development
  viewport: 'width=device-width, initial-scale=1',
  
  // PWA and mobile optimization
  themeColor: '#000000',
  
  // Open Graph tags for social sharing (if needed)
  openGraph: {
    title: 'CryptoWallet - Secure Multi-Chain Wallet',
    description: 'A secure, self-custodial cryptocurrency wallet',
    type: 'website',
    locale: 'en_US',
  },
};

/**
 * Root layout component
 * 
 * Web3 Learning Note: Wallet applications need careful attention to:
 * - Security headers to prevent XSS attacks
 * - Responsive design for mobile usage
 * - Fast loading for better UX during transactions
 * - Clear navigation for complex wallet operations
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <head>
        {/* Security headers for wallet application */}
        <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
        <meta httpEquiv="X-Frame-Options" content="DENY" />
        <meta httpEquiv="X-XSS-Protection" content="1; mode=block" />
        
        {/* Prevent caching of sensitive pages */}
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
        
        {/* Favicon */}
        <link rel="icon" href="/favicon.ico" />
      </head>
      
      <body className={`${inter.className} h-full bg-gray-50 dark:bg-gray-900`}>
        {/* Main application container */}
        <div className="min-h-full">
          <NavBar />
          
          {/* Main content area */}
          <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            <div className="px-4 py-6 sm:px-0">
              {children}
            </div>
          </main>
          
          {/* Footer */}
          <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 mt-auto">
            <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
              <div className="text-center text-sm text-gray-500 dark:text-gray-400">
                <p>
                  🔒 Your keys, your coins. Always verify transactions before signing.
                </p>
                <p className="mt-1">
                  Built with security and privacy in mind • Never share your private keys
                </p>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
