'use client';

import Script from 'next/script';

/**
 * TawkChatWidget Component
 * Integrates the Tawk.to AI/Live Chat widget globally.
 * Loaded after interactive to optimize performance and prevent hydration issues.
 */
export function TawkChatWidget() {
  return (
    <Script
      id="tawk-to-widget"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{
        __html: `
          var Tawk_API=Tawk_API||{}, Tawk_LoadStart=new Date();
          (function(){
          var s1=document.createElement("script"),s0=document.getElementsByTagName("script")[0];
          s1.async=true;
          s1.src='https://embed.tawk.to/6a0a079451864f1c3431d200/1jorir7t6';
          s1.charset='UTF-8';
          s1.setAttribute('crossorigin','*');
          s0.parentNode.insertBefore(s1,s0);
          })();
        `,
      }}
    />
  );
}
