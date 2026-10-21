# 🚦 Traffic Data Processor — Frontend Web Application

Modern, high-performance web dashboard for the Privacy-Preserving Traffic Data Processing Platform. Built with React 18, Vite, Tailwind CSS, Lucide icons, Three.js 3D animations, and Recharts telemetry visualization.

## ✨ Features

- **5-Step Guided Wizard**:
  1. **Upload**: Drag-and-drop file uploader with validation (.csv, .tsv, .txt, .json, .xlsx) and sample dataset loader.
  2. **Data Profiling**: In-memory pre-flight dataset health diagnostics, hour-of-day traffic heatmap, speed distribution histogram, and coordinate scatter.
  3. **Privacy Engine Configuration**: Interactive Privacy Score vs. Utility Score trade-off slider, K-Anonymity preset selector, GPS jitter/rounding controls, and live row transformation preview.
  4. **Processing Pipeline**: Live 3D particle data stream visualization with real-time Server-Sent Events (SSE) status logs.
  5. **Results & Verification**: Telemetry charts, pass/fail QC audit donuts, side-by-side Before/After diff inspector, and multi-format export (Cleaned CSV, JSON, Markdown Audit Report, Processing Config).

## 🛠️ Tech Stack

- **Framework**: React 18
- **Bundler**: Vite
- **Styling**: Tailwind CSS & PostCSS
- **Animations & 3D**: Three.js, Framer Motion, Canvas Confetti
- **Charts & Data Viz**: Recharts
- **Icons**: Lucide React
- **State Management**: Zustand
- **HTTP Client**: Axios
- **Testing**: Playwright (E2E) & Vitest

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/harishramamoorth/Traffic-Data-Processing--Frontend.git
cd Traffic-Data-Processing--Frontend

# Install dependencies
npm install
```

### Running Locally

```bash
# Start the Vite development server
npm run dev
```

The frontend will be available at `http://localhost:5173`.

### Environment Configuration

Configure the backend API URL if different from default:

```env
VITE_API_BASE_URL=http://localhost:5000
```

### Building for Production

```bash
# Build optimized production bundle
npm run build

# Preview production build locally
npm run preview
```

### Testing

```bash
# Run unit & component tests
npm run test

# Run Playwright E2E tests
npx playwright test
```
