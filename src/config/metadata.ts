import packageJson from '~/../package.json';

const cleanUrl = 'drawing app.pages.dev';

const metadata = {
  website: {
    name: 'Drawing App',
    slogan: 'Simple Canvas Drawing App',
    description: 'Open-source canvas drawing web application, built with TypeScript, React, and Next.js.',
    cleanUrl,
    url: `https://${cleanUrl}`,
    manifest: `https://${cleanUrl}/manifest.json`,
    thumbnail: `https://${cleanUrl}/images/thumbnail.jpg`,
    locale: 'en',
    themeColor: '#FFFFFF',
    version: packageJson.version,
  },
  social: {
    twitter: 'drawing app',
  },
  links: {
    github: 'https://github.com/diogocapela/drawing app',
  },
  services: {
    googleAnalyticsMeasurementId: 'G-EZDBLF0NEZ',
  },
};

export default metadata;
