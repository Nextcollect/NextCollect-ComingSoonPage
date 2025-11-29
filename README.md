# Next Collect - Coming Soon

A modern, responsive landing page for Next Collect, Europe's trusted platform for collectors launching in 2026.

## Tech Stack

- **Next.js 14** - React framework with App Router
- **CSS Modules** - Component-scoped styling
- **Design Tokens** - Consistent design system (no Tailwind)

## Project Structure

```
app/
├── components/
│   ├── Navbar/
│   │   ├── index.jsx
│   │   └── styles.module.css
│   ├── Hero/
│   │   ├── index.jsx
│   │   └── styles.module.css
│   ├── Section/
│   │   ├── index.jsx
│   │   └── styles.module.css
│   └── Footer/
│       ├── index.jsx
│       └── styles.module.css
├── styles/
│   ├── tokens.css
│   └── globals.css
├── layout.jsx
└── page.jsx
public/
└── img/
    ├── vector.svg
    ├── frame.svg
    ├── frame-1.svg
    ├── right-1.png
    ├── social-media---menu-icons.svg
    └── footer---right.svg
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (version 18 or higher)

### Installation

Install the dependencies:

```bash
npm install
```

### Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the site in your browser.

### Build

Create an optimized production build:

```bash
npm run build
```

## Design System

The project uses a token-based design system defined in `/app/styles/tokens.css`:

- **Colors**: Primary (#E73439), secondary, accent, and grayscale palette
- **Spacing**: 4px-based spacing scale (space-1 through space-40)
- **Typography**: Inter font family with 1.5 line height
- **Borders**: Radius tokens from sm (4px) to pill (999px)
- **Shadows**: Soft and strong shadow definitions

## Responsive Design

The site is fully responsive with breakpoints at:

- Mobile: max-width 768px
- Tablet: max-width 1200px
- Desktop: 1200px+

All components stack appropriately on smaller screens while maintaining readability and touch-friendly interactions.

## Components

- **Navbar**: Header with logo, language selector, and CTA button
- **Hero**: Main hero section with headline, description, and email signup
- **AboutSection**: Company mission and values
- **FeaturesSection**: Three-column feature grid
- **CTASection**: Call-to-action with waitlist button
- **Footer**: Copyright and branding

## Key Features

- Semantic HTML structure
- Pure CSS Modules (no Tailwind)
- Design token system for consistency
- Fully responsive design
- Clean, production-ready code
- Easy to edit and extend

## License

All rights reserved © Protech
